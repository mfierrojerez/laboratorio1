// Juego de Memoria — versión Pokémon GIF (sin emojis)
document.addEventListener('DOMContentLoaded', init);

function init(){
  // --- Configuración de niveles ---
  const LEVELS = {
    easy:   { pairs: 6,  cols: 3, time: 90,  flipPenalty: 1 },
    medium: { pairs: 8,  cols: 4, time: 120, flipPenalty: 1 },
    hard:   { pairs: 12, cols: 6, time: 180, flipPenalty: 2 }
  };

  // --- Catálogo de cartas (usa rutas de GIF directamente) ---
  // Asegúrate de que los nombres de archivo existan en assets/gif/
  const ANIMALS = [
  { key:'aipom',     file:'assets/gif/aipom.gif' },
  { key:'arbok',     file:'assets/gif/arbok.gif' },
  { key:'charmander',file:'assets/gif/charmander.gif' },
  { key:'chikorita', file:'assets/gif/chikorita.gif' },
  { key:'cyndaquil', file:'assets/gif/cyndaquil.gif' },
  { key:'dragonair', file:'assets/gif/dragonair.gif' },
  { key:'eevee',     file:'assets/gif/eevee.gif' },
  { key:'ghastly',   file:'assets/gif/ghastly.gif' },
  { key:'poochyena', file:'assets/gif/poochyena.gif' },
  { key:'psyduck',   file:'assets/gif/psyduck.gif' },
  { key:'rattata',   file:'assets/gif/rattata.gif' },
  { key:'suicune',   file:'assets/gif/suicune.gif' },
  { key:'umbreon',   file:'assets/gif/umbreon.gif' },
  { key:'vaporeon',  file:'assets/gif/vaporeon.gif' },
];

  // --- DOM refs ---
  const els = {
    board:    q('#board'),
    time:     q('#time'),
    moves:    q('#moves'),
    pairs:    q('#pairs'),
    score:    q('#score'),
    best:     q('#best'),
    level:    q('#level'),
    start:    q('#startBtn'),
    reset:    q('#resetBtn'),
    modal:    q('#modal'),
    summary:  q('#summary'),
    modalBtn: q('#modalBtn'),
    modalTime:    q('#modalTime'),
    summaryTime:  q('#summaryTime'),
    modalTimeBtn: q('#modalTimeBtn'),
    announcer:    q('#sr-announcer')
  };

  // --- Estado ---
  let state = {
    levelKey: 'easy',
    deck: [],
    flippedIdxs: [],
    moves: 0,
    fails: 0,
    foundPairs: 0,
    remainingTime: 0,
    timerId: null,
    lock: false,
    started: false
  };

  // --- Eventos ---
  els.start.addEventListener('click', () => startGame(els.level.value));
  els.reset.addEventListener('click', () => startGame(state.levelKey));
  els.modalBtn && els.modalBtn.addEventListener('click', () => els.modal.hidden = true);
  els.modalTimeBtn && els.modalTimeBtn.addEventListener('click', () => {
    els.modalTime.hidden = true;
    startGame(state.levelKey);
  });

  // --- Lógica principal ---
  function startGame(levelKey){
    clearInterval(state.timerId);
    state = {
      ...state,
      levelKey,
      deck: [],
      flippedIdxs: [],
      moves: 0,
      fails: 0,
      foundPairs: 0,
      remainingTime: LEVELS[levelKey].time,
      timerId: null,
      lock: false,
      started: true
    };

    const { pairs } = LEVELS[levelKey];
    state.deck = buildDeck(pairs);
    renderBoard(state.deck);
    els.board.style.gridTemplateColumns = `repeat(${LEVELS[levelKey].cols}, min(110px,26vw))`;
    loadBest();
    updateHUD();
    startTimer();
    announce(`Nivel ${labelLevel(levelKey)} iniciado. Tienes ${LEVELS[levelKey].time} segundos.`);
  }

  function buildDeck(pairs){
    const pool = shuffle([...ANIMALS]).slice(0, pairs);
    const cards = pool.flatMap(p => ([
      { id:`${p.key}-a`, key:p.key, img:p.file },
      { id:`${p.key}-b`, key:p.key, img:p.file }
    ]));
    return shuffle(cards);
  }

  function renderBoard(deck){
    els.board.innerHTML = deck.map(cardToHTML).join('');
    $$('.card').forEach(btn=>{
      btn.addEventListener('click', () => onCardClick(btn));
      btn.addEventListener('keydown', e=>{
        if(e.key==='Enter' || e.key===' '){ e.preventDefault(); onCardClick(btn); }
      });
    });
    // NOTA: ya no usamos fallback con emojis ni listeners de error en <img>
  }

  function cardToHTML(card, idx){
  return `
    <button class="card" data-index="${idx}" role="gridcell" aria-pressed="false" aria-label="Carta oculta">
      <div class="card-inner">
        <div class="face back">
          <img class="pattern-img" src="assets/pokeball.png" alt="" aria-hidden="true">
        </div>
        <div class="face front">
          <img src="${card.img}" alt="GIF de ${card.key}">
        </div>
      </div>
    </button>
  `;
}

  function onCardClick(btn){
    if(!state.started || state.lock) return;
    const idx = Number(btn.dataset.index);
    if(isSolved(idx) || isFaceUp(idx)) return;

    flipUp(idx);
    state.flippedIdxs.push(idx);

    if(state.flippedIdxs.length === 2){
      state.moves++;
      const [a,b] = state.flippedIdxs;
      if(state.deck[a].key === state.deck[b].key){
        markResolved(a,b);
        state.foundPairs++;
        updateHUD();
        announce(`¡Par de ${state.deck[a].key} encontrado!`);
        state.flippedIdxs = [];
        if(isWin()) endGame(true);
      }else{
        state.lock = true;
        state.fails++;
        updateHUD();
        setTimeout(()=>{
          flipDown(a); flipDown(b);
          state.flippedIdxs = [];
          state.lock = false;
        }, 700);
      }
    }
  }

  // --- Helpers de carta ---
  function cardEl(i){ return q(`.card[data-index="${i}"]`); }
  function isFaceUp(i){ return cardEl(i).classList.contains('is-flipped'); }
  function isSolved(i){ return cardEl(i).classList.contains('matched'); }
  function flipUp(i){ const el = cardEl(i); el.classList.add('is-flipped'); el.setAttribute('aria-pressed','true'); }
  function flipDown(i){ const el = cardEl(i); el.classList.remove('is-flipped'); el.setAttribute('aria-pressed','false'); }
  function markResolved(a,b){
    [a,b].forEach(i=>{
      const el = cardEl(i);
      el.classList.add('matched');
      el.disabled = true;
      el.setAttribute('aria-label', `Carta resuelta: ${state.deck[i].key}`);
    });
  }
  function isWin(){ return state.foundPairs === LEVELS[state.levelKey].pairs; }

  // --- Cronómetro y estados ---
  function startTimer(){
    clearInterval(state.timerId);
    updateTimeUI();
    state.timerId = setInterval(()=>{
      state.remainingTime--;
      updateTimeUI();
      if(state.remainingTime <= 0){
        clearInterval(state.timerId);
        timeUp();
      }
    }, 1000);
  }
  function updateTimeUI(){ els.time.textContent = formatTime(Math.max(0, state.remainingTime)); }
  function timeUp(){
    state.lock = true; state.started = false;
    els.summaryTime.textContent = `Encontraste ${state.foundPairs} de ${LEVELS[state.levelKey].pairs} pares.`;
    els.modalTime.hidden = false;
    announce('Tiempo agotado');
  }

  // --- Puntaje / récord ---
  function usedTime(){ return LEVELS[state.levelKey].time - state.remainingTime; }
  function calcScore(){
    const elapsed = usedTime();
    const base = 1000;
    const movePenalty = state.moves * 10;
    const timePenalty = elapsed * 2;
    const failPenalty = state.fails * LEVELS[state.levelKey].flipPenalty * 5;
    return Math.max(0, Math.round(base - movePenalty - timePenalty - failPenalty));
  }
  function bestKey(){ return `memory_best_${state.levelKey}`; }
  function saveBest(score){
    const k = bestKey();
    const prev = Number(localStorage.getItem(k) || 0);
    if(score > prev){
      localStorage.setItem(k, String(score));
      els.best.textContent = score;
      return { updated:true, prev, score };
    }
    return { updated:false, prev, score };
  }
  function loadBest(){
    const k = bestKey();
    const prev = localStorage.getItem(k);
    els.best.textContent = prev ? prev : '—';
  }

  function endGame(won){
    clearInterval(state.timerId);
    state.started = false;
    if(won){
      const score = calcScore();
      const best = saveBest(score);
      els.summary.innerHTML = `
        Movimientos: <b>${state.moves}</b><br>
        Fallos: <b>${state.fails}</b><br>
        Tiempo usado: <b>${usedTime()} s</b><br>
        Puntaje: <b>${score}</b>${best.updated ? ' (🎉 ¡Nuevo récord!)' : ''}
      `;
      els.modal.hidden = false;
      announce('Nivel completado');
      updateHUD();
    }
  }

  // --- HUD y utilidades ---
  function updateHUD(){
    els.moves.textContent = state.moves;
    els.pairs.textContent = `${state.foundPairs}/${LEVELS[state.levelKey].pairs}`;
    els.score.textContent = calcScore();
  }
  function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
  function formatTime(s){ const m=Math.floor(s/60), r=s%60; return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`; }
  function labelLevel(k){ return k==='easy'?'Fácil':k==='medium'?'Medio':'Difícil'; }
  function announce(msg){ els.announcer.textContent=''; setTimeout(()=> els.announcer.textContent=msg, 20); }
  function q(s){ return document.querySelector(s); }
  function $$(s){ return [...document.querySelectorAll(s)]; }

  // Mostrar récord si existe al cargar
  loadBest();
}

