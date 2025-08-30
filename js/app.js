/* =======================
   Configuración de niveles
   ======================= */
const LEVELS = {
  easy:   { pairs: 6,  cols: 3, time: 90,  flipPenalty: 1 },
  medium: { pairs: 8,  cols: 4, time: 120, flipPenalty: 1 },
  hard:   { pairs: 12, cols: 6, time: 180, flipPenalty: 2 }
};

/* =======================
   Catálogo de animales
   key: nombre base
   emoji: fallback visual
   file: nombre esperado en assets/img/ (opcional)
   ======================= */
const ANIMALS = [
  { key:'zorro',     emoji:'🦊', file:'zorro.jpg' },
  { key:'tigre',     emoji:'🐯', file:'tigre.jpg' },
  { key:'lobo',      emoji:'🐺', file:'lobo.jpg' },
  { key:'panda',     emoji:'🐼', file:'panda.jpg' },
  { key:'pinguino',  emoji:'🐧', file:'pinguino.jpg' },
  { key:'gato',      emoji:'🐱', file:'gato.jpg' },
  { key:'perro',     emoji:'🐶', file:'perro.jpg' },
  { key:'leon',      emoji:'🦁', file:'leon.jpg' },
  { key:'jirafa',    emoji:'🦒', file:'jirafa.jpg' },
  { key:'koala',     emoji:'🐨', file:'koala.jpg' },
  { key:'oso',       emoji:'🐻', file:'oso.jpg' },
  { key:'mono',      emoji:'🐵', file:'mono.jpg' },
  { key:'delfin',    emoji:'🐬', file:'delfin.jpg' },
  { key:'elefante',  emoji:'🐘', file:'elefante.jpg' },
];

/* =======================
   Referencias al DOM
   ======================= */
const els = {
  board: document.getElementById('board'),
  time:  document.getElementById('time'),
  moves: document.getElementById('moves'),
  pairs: document.getElementById('pairs'),
  score: document.getElementById('score'),
  best:  document.getElementById('best'),
  level: document.getElementById('level'),
  start: document.getElementById('startBtn'),
  reset: document.getElementById('resetBtn'),
  modal: document.getElementById('modal'),
  summary: document.getElementById('summary'),
  modalBtn: document.getElementById('modalBtn'),
  modalTime: document.getElementById('modalTime'),
  summaryTime: document.getElementById('summaryTime'),
  modalTimeBtn: document.getElementById('modalTimeBtn'),
  announcer: document.getElementById('sr-announcer')
};

/* =======================
   Estado global
   ======================= */
let state = {
  levelKey: 'easy',
  deck: [],            // [{id, key, emoji, img?}, ...] duplicados
  flippedIdxs: [],     // índices de cartas que están boca arriba (máx 2)
  moves: 0,
  fails: 0,
  foundPairs: 0,
  remainingTime: 0,
  timerId: null,
  lock: false,         // bloqueo de input mientras se desvoltea
  started: false
};

/* =======================
   Listeners UI
   ======================= */
els.start.addEventListener('click', () => startGame(els.level.value));
els.reset.addEventListener('click', () => startGame(state.levelKey));
els.modalBtn.addEventListener('click', () => els.modal.hidden = true);
els.modalTimeBtn.addEventListener('click', () => {
  els.modalTime.hidden = true;
  startGame(state.levelKey);
});

/* =======================
   Funciones principales
   ======================= */
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
  loadBest(); // mostrar récord
  updateHUD();
  startTimer();
  announce(`Nivel ${labelLevel(levelKey)} iniciado. Tienes ${LEVELS[levelKey].time} segundos.`);
}

function buildDeck(pairs){
  const pool = shuffle([...ANIMALS]).slice(0, pairs);
  const cards = pool.flatMap(item => ([
    { id:`${item.key}-a`, key:item.key, emoji:item.emoji, img: `assets/img/${item.file || `${item.key}.jpg`}` },
    { id:`${item.key}-b`, key:item.key, emoji:item.emoji, img: `assets/img/${item.file || `${item.key}.jpg`}` }
  ]));
  return shuffle(cards);
}

function renderBoard(deck){
  els.board.innerHTML = deck.map(cardToHTML).join('');
  // Eventos por carta
  els.board.querySelectorAll('.card').forEach(btn=>{
    btn.addEventListener('click', () => onCardClick(btn));
    btn.addEventListener('keydown', e=>{
      if(e.key==='Enter' || e.key===' '){
        e.preventDefault();
        onCardClick(btn);
      }
    });
  });
  // Fallback de imágenes: si no existe, quitamos <img> y usamos emoji
  els.board.querySelectorAll('.face.front img').forEach(img=>{
    img.addEventListener('error', ()=>{
      const front = img.closest('.face.front');
      front.classList.add('no-img');
      img.remove();
    }, { once:true });
  });
}

function cardToHTML(card, idx){
  // alt describe la carta cuando está descubierta
  const alt = `Imagen de ${card.key}`;
  return `
  <button class="card" data-index="${idx}" role="gridcell" aria-pressed="false" aria-label="Carta oculta">
    <div class="card-inner">
      <div class="face back"><span class="pattern">🐾</span></div>
      <div class="face front">
        <img src="${card.img}" alt="${alt}" />
        <span class="emoji" aria-hidden="true">${card.emoji}</span>
      </div>
    </div>
  </button>`;
}

function onCardClick(btn){
  if(!state.started) return;
  if(state.lock) return;

  const idx = Number(btn.dataset.index);
  if(isSolved(idx) || isFaceUp(idx)) return;

  flipUp(idx);

  // Controlar array flipped
  state.flippedIdxs.push(idx);
  if(state.flippedIdxs.length === 2){
    state.moves++;
    const [a, b] = state.flippedIdxs;
    if(state.deck[a].key === state.deck[b].key){
      // Match
      markResolved(a, b);
      state.foundPairs++;
      updateHUD();
      announce(`¡Par de ${state.deck[a].key} encontrado!`);
      if(isWin()){
        endGame(true);
      }
      state.flippedIdxs = [];
    }else{
      // No match → bloquear, revertir tras un delay
      state.lock = true;
      state.fails++;
      updateHUD();
      setTimeout(()=>{
        flipDown(a);
        flipDown(b);
        state.flippedIdxs = [];
        state.lock = false;
      }, 700);
    }
  }
}

function isFaceUp(idx){
  const cardEl = cardElement(idx);
  return cardEl.classList.contains('is-flipped');
}
function isSolved(idx){
  const cardEl = cardElement(idx);
  return cardEl.classList.contains('matched');
}

function cardElement(idx){
  return els.board.querySelector(`.card[data-index="${idx}"]`);
}
function flipUp(idx){
  const el = cardElement(idx);
  el.classList.add('is-flipped');
  el.setAttribute('aria-pressed','true');
}
function flipDown(idx){
  const el = cardElement(idx);
  el.classList.remove('is-flipped');
  el.setAttribute('aria-pressed','false');
}
function markResolved(a, b){
  [a,b].forEach(i=>{
    const el = cardElement(i);
    el.classList.add('matched');
    el.setAttribute('aria-pressed','true');
    el.setAttribute('aria-label', `Carta resuelta: ${state.deck[i].key}`);
    el.disabled = true; // quitar foco/tab
  });
}

function isWin(){
  const needed = LEVELS[state.levelKey].pairs;
  return state.foundPairs === needed;
}

/* =======================
   Cronómetro y fin de juego
   ======================= */
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

function updateTimeUI(){
  els.time.textContent = formatTime(Math.max(0, state.remainingTime));
}

function timeUp(){
  // Bloquear clicks
  state.lock = true;
  state.started = false;
  // Mostrar modal de tiempo agotado
  const found = state.foundPairs;
  const total = LEVELS[state.levelKey].pairs;
  els.summaryTime.textContent = `Encontraste ${found} de ${total} pares. ¡Puedes lograrlo!`;
  els.modalTime.hidden = false;
  announce('Tiempo agotado. Puedes reintentar.');
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
      Puntaje: <b>${score}</b>${best.updated ? ' (🎉 ¡Nuevo récord!)' : '' }
    `;
    els.modal.hidden = false;
    announce('Nivel completado.');
    updateHUD(); // refrescar récord
  }
}

function usedTime(){
  const total = LEVELS[state.levelKey].time;
  return total - state.remainingTime;
}

/* =======================
   Puntaje y récord
   ======================= */
function calcScore(){
  // Ajusta coeficientes si quieres “afinar” dificultad
  const elapsed = usedTime();
  const base = 1000;
  const movePenalty = state.moves * 10;
  const timePenalty = elapsed * 2;
  const failPenalty = state.fails * LEVELS[state.levelKey].flipPenalty * 5;
  return Math.max(0, Math.round(base - movePenalty - timePenalty - failPenalty));
}

function bestKey(){
  return `memory_best_${state.levelKey}`;
}
function saveBest(score){
  const key = bestKey();
  const prev = Number(localStorage.getItem(key) || 0);
  if(score > prev){
    localStorage.setItem(key, String(score));
    els.best.textContent = score;
    return { updated:true, prev, score };
  }
  return { updated:false, prev, score };
}
function loadBest(){
  const key = bestKey();
  const prev = localStorage.getItem(key);
  els.best.textContent = prev ? prev : '—';
}

function updateHUD(){
  els.moves.textContent = state.moves;
  els.pairs.textContent = `${state.foundPairs}/${LEVELS[state.levelKey].pairs}`;
  els.score.textContent = calcScore();
}

/* =======================
   Utilidades
   ======================= */
function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

function formatTime(sec){
  const m = Math.floor(sec/60);
  const s = sec%60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function labelLevel(key){
  return key==='easy' ? 'Fácil' : key==='medium' ? 'Medio' : 'Difícil';
}

function announce(msg){
  // Mensaje discreto para lectores de pantalla
  els.announcer.textContent = '';
  setTimeout(()=> els.announcer.textContent = msg, 20);
}

/* =======================
   Inicio opcional
   ======================= */
// Arranca en "Fácil" mostrando récord si existiera
loadBest();
