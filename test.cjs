// node site/test.cjs
const assert = require('node:assert');
const html = require('node:fs').readFileSync(__dirname + '/index.html', 'utf8');
const src = html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1];
const E = new Function(src + '; return {WORLD, verify, buildTree, walk, goBack, approve, gate, settle};')();

const leaves = n => n.key ? n.branches.flatMap(b => leaves(b.child)) : [n.products.map(p => p.id).join('')];
const board = E.WORLD.board;

// tree: matches the plan (A/S -> grade | budget), every product reachable once
let t = E.buildTree(board, ['cpu']);
assert.equal(t.root.key, 'as');
assert.deepEqual(t.root.branches.map(b => b.child.key), ['grade', 'budget']);
assert.deepEqual(leaves(t.root), ['ab', 'c', 'd', 'ef']);
assert.deepEqual(leaves(E.buildTree(board, ['cpu', 'budget']).root), ['ab', 'c', 'def']); // known budget is not asked again
assert.equal(E.buildTree(E.WORLD.stand).root.key, 'cheap'); // simple item: price first
assert.equal(E.buildTree(E.WORLD.rare).fallback, true);
assert.equal(E.buildTree(E.WORLD.rare, ['budget']).root.key, 'ship');

// back to any step re-asks that question
const answers = [{value: '중요해요'}, {value: '상급형'}];
assert.equal(E.walk(t.root, E.goBack(answers, 0)).key, 'as');
assert.equal(E.walk(t.root, E.goBack(answers, 1)).key, 'grade');

// invented quote is dropped, real ones stay
assert.equal(E.verify(board).length, board.claims.length - 1);

// payment gate: any single change blocks payment
const seen = board.products[0].offers[0], now = 1000;
const mandate = {budget: 250000, markets: ['n']};
const fresh = () => E.approve('auto', seen, mandate, 240000, 7, now);
const bad = [{stock: false}, {price: 240001}, {tax: undefined}, {seller: 'x'}, {url: 'x'}, {id: 'x'}, {model: 'x'},
  {option: 'x'}, {qty: 2}, {eta: 9}, {returns: false}, {extra: true}, {m: 'b'}];
for (const change of bad) {
  const paid = [];
  assert.equal(E.settle(fresh(), {...seen, stock: true, ...change}, paid, now).ok, false, JSON.stringify(change));
  assert.equal(paid.length, 0);
}
for (const state of ['cancelled', 'expired', 'halted', 'processing', 'done']) {
  assert.equal(E.settle({...fresh(), state}, {...seen, stock: true}, [], now).ok, false, state);
}
let paid = [], a = fresh();
assert.equal(E.settle(a, {...seen, stock: true}, paid, a.expires + 1).ok, false);

a = fresh();
assert.equal(E.settle(a, {...seen, stock: true}, paid, now).ok, true);
assert.equal(E.settle(a, {...seen, stock: true}, paid, now).ok, false); // duplicate notification
assert.equal(paid.length, 1);

// per-order approval: even a cheaper total is re-confirmed, and budget holds
const b = board.products[1].offers[0];
for (const price of [b.price - 1, b.price + 1]) {
  assert.equal(E.settle(E.approve('once', b, mandate, null, 1, now), {...b, price}, [], now).ok, false);
}
assert.equal(E.settle(E.approve('once', b, mandate, null, 1, now), b, [], now).ok, true);
assert.equal(E.settle(E.approve('once', b, {...mandate, budget: 1}, null, 1, now), b, [], now).ok, false);

console.log('all checks passed');
