#!/usr/bin/env node
/* Gera uma página solta com os botões e as portas, usando o CSS a sério de
   pagina.js — não uma cópia. Serve para se ver a pressão com o dedo e com o
   rato; uma cópia do CSS aqui deixava de mostrar o que está no servidor no
   dia seguinte ao primeiro ajuste. Correr: node tools/botoes-demo.js [saída] */
const fs = require('node:fs');
const { CSS } = require(require('node:path').join(__dirname, '..', 'server', 'pagina.js'));

const html = [
  '<title>CAPEM · botões</title>',
  '<style>', CSS,
  'body{margin:0;background:var(--papel)}',
  'main{max-width:640px;margin:0 auto;padding:28px 20px 90px}',
  'h1{font:700 22px/1.25 var(--fonte);text-transform:uppercase;letter-spacing:.04em;margin:0 0 6px}',
  'h2{font:700 12px/1 var(--fonte);text-transform:uppercase;letter-spacing:.08em;',
  '   color:var(--texto-2);margin:36px 0 6px;border-bottom:2px solid var(--fio);padding-bottom:8px}',
  'main>p{font:500 14px/1.6 var(--fonte);color:var(--texto-2);margin:0 0 4px}',
  '.linha{display:flex;flex-wrap:wrap;gap:26px;align-items:flex-start}',
  '</style>',
  '<main>',
  '<h1>Botões</h1>',
  '<p>Carregue e mantenha. Desce 3&nbsp;px de repente e a sombra encolhe; ao largar',
  'sobe em 140&nbsp;ms. Com rato, passar por cima levanta 1&nbsp;px — e carregar tem',
  'de ganhar a isso.</p>',
  '<h2>Os três botões</h2>',
  '<div class="linha">',
  '  <button class="btn">Botão simples</button>',
  '  <button class="btn btn-primario">Confirmar</button>',
  '  <button class="btn btn-recusar">Recusar</button>',
  '</div>',
  '<h2>Desligado — não se levanta</h2>',
  '<div class="linha"><button class="btn" disabled>Sem código</button></div>',
  '<h2>As portas</h2>',
  '<a class="porta" href="#"><b>Material impresso</b>',
  '<span>Cartazes e etiquetas para imprimir no centro.</span></a>',
  '<a class="porta" href="#"><b>Atualizar a lista</b>',
  '<span>Entrar com o código do centro.</span></a>',
  '</main>'
].join('\n');

const saida = process.argv[2] || 'botoes-demo.html';
fs.writeFileSync(saida, html);
console.log(saida + ' — ' + html.length + ' bytes');
