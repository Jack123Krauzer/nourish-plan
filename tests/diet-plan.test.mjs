import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../sajid-maulana.html', import.meta.url), 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/i);
assert.ok(match, 'The diet planner script must exist');

class Element {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.events = {};
    this.attributes = {};
    this.style = {};
    this._text = '';
    this.className = '';
    this.checked = false;
    this.disabled = false;
    this.innerHTML = '';
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = [...children]; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(type, callback) { this.events[type] = callback; }
  scrollIntoView() {}
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text || this.children.map(child => child.textContent || '').join(''); }
  click() { this.events.click?.(); }
}

const elements = {};
const document = {
  createElement: tag => new Element(tag),
  createTextNode: value => { const n = new Element('text'); n.textContent = value; return n; },
  getElementById: id => elements[id] ||= new Element('div')
};
const store = {};
const localStorage = {getItem: key => store[key] || null, setItem: (key, value) => {store[key] = value;}};
let printCalls = 0;
let resetConfirmations = 0;
const context = {document, localStorage, window: {print: () => {printCalls++;}}, confirm: () => {resetConfirmations++; return true;}};
runInNewContext(match[1] + '\nglobalThis.qa = { days, recipes, foodCategory, makeFoodGraphic, makeRow, completed, goToDay };', context);
const qa = context.qa;
const walk = (node, tag) => [
  ...(node.tag === tag ? [node] : []),
  ...node.children.flatMap(child => child && typeof child === 'object' ? walk(child, tag) : [])
];
const sum = (rows, index) => rows.reduce((total, row) => total + row[index], 0);

test('seven days, 42 meals, 136 food rows with five valid columns', () => {
  assert.equal(qa.days.length, 7);
  assert.equal(qa.days.reduce((total, day) => total + day.length, 0), 42);
  const rows = qa.days.flatMap(day => day.flatMap(meal => meal[2]));
  assert.equal(rows.length, 136);
  for (const row of rows) {
    assert.equal(row.length, 5);
    assert.ok(row.every(value => value !== null && value !== undefined && value !== ''));
    assert.ok(Number.isFinite(row[3]) && row[3] >= 0);
    assert.ok(Number.isFinite(row[4]) && row[4] >= 0);
  }
});

test('nutrition totals stay near 2,200 kcal and 100–120g protein each day', () => {
  qa.days.forEach((day, i) => {
    const rows = day.flatMap(meal => meal[2]);
    assert.ok(Math.abs(sum(rows, 3) - 2200) <= 25, 'Day ' + (i + 1) + ' calories');
    assert.ok(sum(rows, 4) >= 100 && sum(rows, 4) <= 120, 'Day ' + (i + 1) + ' protein');
  });
});

test('every food gets an SVG and boiled eggs are never mislabeled cooking oil', () => {
  qa.days.forEach(day => day.forEach(meal => meal[2].forEach(row => {
    assert.match(qa.makeFoodGraphic(row[1]).innerHTML, /<svg/);
    assert.notEqual(qa.foodCategory(row[1]), 'other', row[1]);
    if (/boiled eggs/i.test(row[1])) {
      assert.equal(qa.foodCategory(row[1]), 'egg');
      assert.doesNotMatch(qa.makeRow(row).textContent, /for cooking/i);
    }
  })));
  assert.equal(qa.foodCategory('Cucumber raita'), 'curd');
  assert.equal(qa.foodCategory('Cooking oil'), 'oil');
});

test('every day renders six meals, five headings and correctly aligned totals', () => {
  qa.days.forEach((day, i) => {
    qa.goToDay(i);
    assert.equal(elements.dayTabs.children.length, 7);
    assert.equal(elements.mealList.children.length, 6);
    const tables = walk(elements.mealList, 'table');
    assert.equal(tables.length, 6);
    tables.forEach((table, mealIndex) => {
      const body = table.children.find(n => n.tag === 'tbody');
      const header = table.children.find(n => n.tag === 'thead');
      const footer = table.children.find(n => n.tag === 'tfoot');
      assert.equal(header.children[0].children.length, 5);
      assert.equal(body.children.length, day[mealIndex][2].length);
      assert.equal(footer.children[0].children.length, 3);
      assert.equal(footer.children[0].children[0].colSpan, 3);
      assert.equal(Number(footer.children[0].children[1].textContent), sum(day[mealIndex][2], 3));
      assert.equal(footer.children[0].children[2].textContent, sum(day[mealIndex][2], 4) + ' g');
    });
  });
});

test('day navigation, completion, browser storage, reset and print controls', () => {
  qa.goToDay(0);
  const check1 = walk(elements.mealList, 'input')[0];
  check1.checked = true;
  check1.events.change();
  assert.equal(qa.completed(0), 1);
  assert.equal(elements.ringCount.textContent, '1/6');
  assert.ok(store['nourish-sajid-meals-v1']);
  qa.goToDay(1);
  assert.equal(qa.completed(1), 0);
  const check2 = walk(elements.mealList, 'input')[0];
  check2.checked = true;
  check2.events.change();
  qa.goToDay(0);
  assert.equal(qa.completed(0), 1);
  elements.resetDay.click();
  assert.equal(qa.completed(0), 0);
  assert.equal(qa.completed(1), 1);
  assert.equal(resetConfirmations, 1);
  elements.printTop.click();
  elements.printSide.click();
  assert.equal(printCalls, 2);
});

test('recipes, mobile layout, print layout and footer styling exist', () => {
  assert.ok(Object.keys(qa.recipes).length >= 20);
  assert.match(html, /@media\(max-width:620px\)/);
  assert.match(html, /@media print/);
  assert.match(html, /total-kcal/);
  assert.match(html, /total-protein/);
});
