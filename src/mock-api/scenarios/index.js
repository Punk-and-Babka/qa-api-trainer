// Реестр сценариев. Сценарий — это связка из пяти вещей: спецификация,
// обработчики сервера, каталог дефектов, задания и схемы ответов. Всё
// остальное приложение работает с любым сценарием одинаково и про Users или
// Orders ничего не знает.
//
// Добавление сценария — правка одного этого файла плюс его собственные файлы
// рядом.

import { usersContract } from './users.contract.js';
import { usersRoutes } from './users.handlers.js';
import { bugs as usersBugs } from './users.bugs.js';
import { usersTasks } from './users.tasks.js';
import { responseSchemas as usersSchemas } from './users.schemas.js';
import { resetUsers } from './users.state.js';
import { ordersContract } from './orders.contract.js';
import { ordersRoutes } from './orders.handlers.js';
import { bugs as ordersBugs } from './orders.bugs.js';
import { ordersTasks } from './orders.tasks.js';
import { responseSchemas as ordersSchemas } from './orders.schemas.js';
import { resetOrders } from './orders.state.js';

export const SCENARIOS = [
  {
    id: 'users',
    title: 'Users API',
    summary: 'Справочник пользователей: список, создание, обновление, удаление.',
    contract: usersContract,
    routes: usersRoutes,
    bugs: usersBugs,
    tasks: usersTasks,
    schemas: usersSchemas,
    reset: resetUsers,
  },
  {
    id: 'orders',
    title: 'Orders API',
    summary:
      'Заказы магазина: суммы, скидки, статусы, оплата. Дефекты в смысле ответа, ' +
      'а не в его форме — сценарий для ручного тестирования.',
    contract: ordersContract,
    routes: ordersRoutes,
    bugs: ordersBugs,
    tasks: ordersTasks,
    schemas: ordersSchemas,
    reset: resetOrders,
  },
];

export const DEFAULT_SCENARIO = SCENARIOS[0].id;

export function findScenario(id) {
  return SCENARIOS.find((scenario) => scenario.id === id) ?? SCENARIOS[0];
}

// Значение из снимка localStorage может быть чужим или от удалённого сценария.
export function sanitizeScenario(saved) {
  return SCENARIOS.some((scenario) => scenario.id === saved) ? saved : DEFAULT_SCENARIO;
}

// Идентификаторы дефектов обязаны быть уникальными не только внутри сценария,
// но и между сценариями: прогресс хранится плоским списком найденных id, и
// совпадение означало бы, что дефект в одном сценарии засчитывается в другом.
function assertGloballyUniqueBugIds(scenarios) {
  const seen = new Map();

  for (const scenario of scenarios) {
    for (const bug of scenario.bugs) {
      const owner = seen.get(bug.id);
      if (owner !== undefined) {
        throw new Error(
          `Дефект "${bug.id}" объявлен и в сценарии "${owner}", и в "${scenario.id}". ` +
            'Идентификаторы дефектов должны быть уникальны между сценариями: ' +
            'прогресс хранится общим списком id.',
        );
      }
      seen.set(bug.id, scenario.id);
    }
  }
}

function assertUniqueScenarioIds(scenarios) {
  const seen = new Set();

  for (const scenario of scenarios) {
    if (seen.has(scenario.id)) {
      throw new Error(`Сценарий "${scenario.id}" объявлен дважды.`);
    }
    seen.add(scenario.id);
  }
}

assertUniqueScenarioIds(SCENARIOS);
assertGloballyUniqueBugIds(SCENARIOS);
