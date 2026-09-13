// Мини-expect: небольшое подмножество chai, ровно то, что нужно в тестах
// ответа. Настоящий chai в Postman весит на порядок больше и умеет вещи,
// которых здесь не будет никогда.
//
// Устройство цепочки `expect(x).to.have.property('id')`: слова-связки `to`,
// `be`, `have` и прочие — это геттеры, возвращающие тот же самый объект. Они
// ничего не делают, они читаются. Проверку выполняет метод в конце цепочки.
// `not` — единственная связка со смыслом: она возвращает новый объект с
// перевёрнутым флагом отрицания.

// Слова-связки без поведения. Нужны, чтобы `.to.be.a('string')` и
// `.to.have.lengthOf(3)` читались по-английски, как в chai.
const CHAIN_WORDS = ['to', 'be', 'been', 'is', 'that', 'which', 'and', 'has', 'have', 'with'];

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

// Сравнение по значению, а не по ссылке: два разных объекта с одинаковым
// содержимым должны считаться равными (это chai-шный eql).
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeOf(a) !== typeOf(b)) return false;

  if (Array.isArray(a)) {
    return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
  }
  if (typeOf(a) === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    return (
      keysA.length === keysB.length &&
      keysA.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]))
    );
  }
  // NaN !== NaN, но для сравнения значений их логично считать одинаковыми.
  return Number.isNaN(a) && Number.isNaN(b);
}

function show(value) {
  if (typeof value === 'string') return `"${value}"`;
  if (value === undefined) return 'undefined';
  try {
    return JSON.stringify(value);
  } catch {
    // Циклическая ссылка: JSON.stringify бросает, а падать из-за сообщения
    // об ошибке нельзя — тест уже и так не прошёл.
    return String(value);
  }
}

function build(actual, negated) {
  const self = {};

  function assert(pass, expectation) {
    // pass === negated означает «результат совпал с тем, что запрещено»:
    // либо проверка не прошла без .not, либо прошла вместе с .not.
    if (pass === negated) {
      throw new Error(
        `получено ${show(actual)}, ожидалось${negated ? ' не' : ''}: ${expectation}`,
      );
    }
  }

  // Геттеры-связки возвращают self, поэтому цепочка любой длины остаётся тем
  // же объектом. Единственное исключение — not.
  for (const word of CHAIN_WORDS) {
    Object.defineProperty(self, word, { get: () => self });
  }
  Object.defineProperty(self, 'not', { get: () => build(actual, !negated) });

  // Проверки без скобок. В chai они тоже геттеры: `.to.be.null` срабатывает
  // в момент чтения свойства, а не вызова.
  Object.defineProperty(self, 'null', {
    get: () => assert(actual === null, 'null'),
  });
  Object.defineProperty(self, 'undefined', {
    get: () => assert(actual === undefined, 'undefined'),
  });
  Object.defineProperty(self, 'true', {
    get: () => assert(actual === true, 'true'),
  });
  Object.defineProperty(self, 'false', {
    get: () => assert(actual === false, 'false'),
  });
  Object.defineProperty(self, 'exist', {
    get: () => assert(actual !== null && actual !== undefined, 'не null и не undefined'),
  });
  Object.defineProperty(self, 'empty', {
    get: () => {
      const length =
        typeof actual === 'string' || Array.isArray(actual)
          ? actual.length
          : Object.keys(actual ?? {}).length;
      return assert(length === 0, 'пустое значение');
    },
  });

  self.equal = (expected) => assert(actual === expected, `строго равно ${show(expected)}`);
  self.eql = (expected) => assert(deepEqual(actual, expected), `равно по значению ${show(expected)}`);

  self.a = (type) => assert(typeOf(actual) === type, `тип ${type}, получен ${typeOf(actual)}`);
  self.an = self.a;

  self.property = (name, value) => {
    const present = actual !== null && actual !== undefined && Object.hasOwn(actual, name);
    if (value === undefined) {
      return assert(present, `наличие поля "${name}"`);
    }
    return assert(
      present && deepEqual(actual[name], value),
      `поле "${name}" со значением ${show(value)}`,
    );
  };

  self.lengthOf = (expected) =>
    assert(actual?.length === expected, `длина ${expected}, получена ${actual?.length}`);

  self.include = (item) => {
    const contains =
      typeof actual === 'string' ? actual.includes(item) : (actual ?? []).some((x) => deepEqual(x, item));
    return assert(contains, `наличие ${show(item)} внутри`);
  };

  self.above = (limit) => assert(actual > limit, `больше ${show(limit)}`);
  self.below = (limit) => assert(actual < limit, `меньше ${show(limit)}`);
  self.oneOf = (list) => assert(list.some((x) => deepEqual(actual, x)), `одно из ${show(list)}`);

  return self;
}

export function expect(actual) {
  return build(actual, false);
}
