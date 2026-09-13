// Мини-expect. Каждый матчер проверяется с обеих сторон: он обязан пропустить
// верное и уронить неверное. Односторонняя проверка здесь бесполезна —
// матчер, который не бросает никогда, пройдёт её целиком, а в тренажёре это
// худший вид поломки: тесты студента становятся вечнозелёными и молчат о
// настоящих дефектах.
//
// По той же причине у каждого матчера проверяется и .not: ошибка во флаге
// отрицания даёт ровно такой же вечнозелёный результат.

import test from 'node:test';
import assert from 'node:assert/strict';
import { expect } from '../src/expect.js';

// Проверка обязана пройти молча.
function passes(name, fn) {
  assert.doesNotThrow(fn, `${name}: должно было пройти`);
}

// Проверка обязана бросить Error — именно так мини-expect сообщает о провале.
function fails(name, fn) {
  assert.throws(fn, Error, `${name}: должно было упасть`);
}

test('equal — строгое равенство', () => {
  passes('равные числа', () => expect(200).to.equal(200));
  fails('разные числа', () => expect(200).to.equal(201));
  // Строгое сравнение: приведения типов быть не должно.
  fails('число и строка', () => expect(200).to.equal('200'));
  // Объекты сравниваются по ссылке — для содержимого есть eql.
  fails('одинаковые объекты по ссылке', () => expect({ a: 1 }).to.equal({ a: 1 }));

  passes('not на разных', () => expect(200).to.not.equal(201));
  fails('not на равных', () => expect(200).to.not.equal(200));
});

test('eql — равенство по значению', () => {
  passes('плоские объекты', () => expect({ a: 1 }).to.eql({ a: 1 }));
  passes('вложенные структуры', () => expect({ a: [1, { b: 2 }] }).to.eql({ a: [1, { b: 2 }] }));
  passes('пустые массивы', () => expect([]).to.eql([]));
  passes('NaN сам с собой', () => expect(NaN).to.eql(NaN));

  fails('разные значения', () => expect({ a: 1 }).to.eql({ a: 2 }));
  fails('лишнее поле', () => expect({ a: 1, b: 2 }).to.eql({ a: 1 }));
  fails('недостающее поле', () => expect({ a: 1 }).to.eql({ a: 1, b: 2 }));
  fails('разный порядок в массиве', () => expect([1, 2]).to.eql([2, 1]));
  fails('массив и объект', () => expect([]).to.eql({}));

  passes('not на разных', () => expect({ a: 1 }).to.not.eql({ a: 2 }));
  fails('not на одинаковых', () => expect({ a: 1 }).to.not.eql({ a: 1 }));
});

test('a — тип значения', () => {
  passes('строка', () => expect('x').to.be.a('string'));
  passes('число', () => expect(1).to.be.a('number'));
  passes('массив отличается от объекта', () => expect([]).to.be.a('array'));
  passes('null — отдельный тип', () => expect(null).to.be.a('null'));
  passes('an — синоним a', () => expect({}).to.be.an('object'));

  fails('число вместо строки', () => expect(1).to.be.a('string'));
  fails('массив вместо объекта', () => expect([]).to.be.a('object'));
  fails('null вместо объекта', () => expect(null).to.be.a('object'));

  passes('not на чужом типе', () => expect(1).to.not.be.a('string'));
  fails('not на своём типе', () => expect(1).to.not.be.a('number'));
});

test('property — наличие поля и его значение', () => {
  passes('поле есть', () => expect({ id: 1 }).to.have.property('id'));
  passes('поле с нужным значением', () => expect({ id: 1 }).to.have.property('id', 1));
  passes('значение сравнивается по значению', () =>
    expect({ user: { id: 1 } }).to.have.property('user', { id: 1 }));

  fails('поля нет', () => expect({ id: 1 }).to.have.property('email'));
  fails('значение другое', () => expect({ id: 1 }).to.have.property('id', 2));
  // Именно этим ловится B3, и падать на null оно не имеет права.
  fails('поля нет у null', () => expect(null).to.have.property('id'));

  passes('not на отсутствующем поле', () =>
    expect({ id: 1 }).to.not.have.property('passwordHash'));
  fails('not на существующем поле', () => expect({ id: 1 }).to.not.have.property('id'));
});

test('lengthOf — длина строки и массива', () => {
  passes('массив', () => expect([1, 2, 3]).to.have.lengthOf(3));
  passes('строка', () => expect('abc').to.have.lengthOf(3));
  passes('пусто', () => expect([]).to.have.lengthOf(0));

  fails('другая длина', () => expect([1]).to.have.lengthOf(2));
  fails('у числа длины нет', () => expect(5).to.have.lengthOf(1));

  passes('not', () => expect([1]).to.not.have.lengthOf(2));
  fails('not на совпадении', () => expect([1]).to.not.have.lengthOf(1));
});

test('include — подстрока и элемент массива', () => {
  passes('подстрока', () => expect('user@example.com').to.include('@'));
  passes('элемент массива', () => expect(['a', 'b']).to.include('b'));
  passes('элемент сравнивается по значению', () => expect([{ id: 1 }]).to.include({ id: 1 }));

  fails('нет подстроки', () => expect('abc').to.include('@'));
  fails('нет элемента', () => expect(['a']).to.include('b'));

  passes('not', () => expect('abc').to.not.include('@'));
  fails('not на совпадении', () => expect('a@b').to.not.include('@'));
});

test('above и below — сравнение чисел', () => {
  passes('больше', () => expect(5).to.be.above(1));
  passes('меньше', () => expect(1).to.be.below(5));

  fails('не больше', () => expect(1).to.be.above(5));
  fails('граница не считается больше', () => expect(5).to.be.above(5));
  fails('граница не считается меньше', () => expect(5).to.be.below(5));

  passes('not', () => expect(1).to.not.be.above(5));
  fails('not на верном', () => expect(5).to.not.be.above(1));
});

test('oneOf — значение из списка', () => {
  passes('есть в списке', () => expect('admin').to.be.oneOf(['user', 'admin']));
  fails('нет в списке', () => expect('root').to.be.oneOf(['user', 'admin']));
  fails('пустой список', () => expect('user').to.be.oneOf([]));

  passes('not', () => expect('root').to.not.be.oneOf(['user', 'admin']));
  fails('not на совпадении', () => expect('user').to.not.be.oneOf(['user']));
});

test('проверки без скобок — это геттеры и они срабатывают при чтении', () => {
  passes('null', () => expect(null).to.be.null);
  fails('не null', () => expect(0).to.be.null);
  // Ноль, пустая строка и undefined не должны считаться за null.
  fails('undefined это не null', () => expect(undefined).to.be.null);

  passes('undefined', () => expect(undefined).to.be.undefined);
  fails('null это не undefined', () => expect(null).to.be.undefined);

  passes('true', () => expect(true).to.be.true);
  fails('единица это не true', () => expect(1).to.be.true);

  passes('false', () => expect(false).to.be.false);
  fails('ноль это не false', () => expect(0).to.be.false);

  passes('exist на нуле', () => expect(0).to.be.exist);
  fails('exist на null', () => expect(null).to.be.exist);
  fails('exist на undefined', () => expect(undefined).to.be.exist);

  passes('empty на пустом массиве', () => expect([]).to.be.empty);
  passes('empty на пустой строке', () => expect('').to.be.empty);
  passes('empty на пустом объекте', () => expect({}).to.be.empty);
  fails('empty на непустом', () => expect([1]).to.be.empty);

  passes('not на геттере', () => expect(1).to.not.be.null);
  fails('not на геттере при совпадении', () => expect(null).to.not.be.null);
});

test('слова-связки ничего не меняют', () => {
  // Длинная цепочка обязана вести себя ровно как короткая: связки — пустышки.
  passes('короткая', () => expect(1).to.equal(1));
  passes('длинная', () => expect(1).to.be.that.is.and.have.with.equal(1));
  fails('длинная на неверном', () => expect(1).to.be.that.is.and.have.with.equal(2));
});

test('двойное отрицание возвращает исходный смысл', () => {
  passes('not.not на равных', () => expect(1).to.not.not.equal(1));
  fails('not.not на разных', () => expect(1).to.not.not.equal(2));
});

test('сообщение об ошибке называет фактическое значение', () => {
  // Сообщение читает студент, и без фактического значения оно бесполезно.
  assert.throws(() => expect(200).to.equal(201), /200/);
  assert.throws(() => expect(200).to.equal(201), /201/);
  assert.throws(() => expect('abc').to.include('@'), /abc/);
  // Отрицание должно быть видно в тексте, иначе сообщение читается наоборот.
  assert.throws(() => expect(1).to.not.equal(1), /не/);
});

test('циклическая ссылка не роняет формирование сообщения', () => {
  // JSON.stringify на такой структуре бросает, а падать при составлении
  // текста ошибки нельзя: тест и так уже не прошёл.
  const cyclic = { name: 'x' };
  cyclic.self = cyclic;

  assert.throws(() => expect(cyclic).to.equal(1), Error);
});
