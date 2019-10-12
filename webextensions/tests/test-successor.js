/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  wait
} from '/common/common.js';
import { is /*, ok, ng*/ } from '/tests/assert.js';
//import Tab from '/common/Tab.js';

import * as Constants from '/common/constants.js';
import * as Utils from './utils.js';

let win;

export async function setup() {
  win = await browser.windows.create();
}

export async function teardown() {
  await browser.windows.remove(win.id);
  win = null;
}

async function getActiveTabName(tabs) {
  const activeTabs = await browser.tabs.query({ windowId: win.id, active: true });
  return Object.keys(tabs).find(key => tabs[key].id == activeTabs[0].id);
}

export async function testSuccessorForLastChildWithPreviousSibling() {
  await Utils.setConfigs({
    successorTabControlLevel: Constants.kSUCCESSOR_TAB_CONTROL_IN_TREE,
    simulateSelectOwnerOnClose: false
  });

  let tabs = await Utils.createTabs({
    A: { index: 1 },
    B: { index: 2, openerTabId: 'A' },
    C: { index: 3, openerTabId: 'A', active: true },
    D: { index: 4 }
  }, { windowId: win.id });
  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, B, C, D } = tabs;
    is([
      `${A.id}`,
      `${A.id} => ${B.id}`,
      `${A.id} => ${C.id}`,
      `${D.id}`
    ], Utils.treeStructure(Object.values(tabs)),
       'tabs must be initialized with specified structure');
    is([A.id, B.id, C.id, D.id],
       await Utils.tabsOrder([A, B, C, D]),
       'tabs must be initialized with specified order');
    is('C', await getActiveTabName(tabs),
       'the last child tab must be active');
  }

  await browser.tabs.remove(tabs.C.id);
  await wait(1000);

  is('B', await getActiveTabName(tabs),
     'new last child tab must be the successor.');
}

export async function testSuccessorForLastChildWithoutPreviousSibling() {
  await Utils.setConfigs({
    successorTabControlLevel: Constants.kSUCCESSOR_TAB_CONTROL_IN_TREE,
    simulateSelectOwnerOnClose: false
  });

  let tabs = await Utils.createTabs({
    A: { index: 1, active: false },
    B: { index: 2, openerTabId: 'A', active: false },
    C: { index: 3, openerTabId: 'B', active: false },
    D: { index: 3, openerTabId: 'A', active: false },
    E: { index: 5, active: false }
  }, { windowId: win.id });
  // deactivate the effect of the "browser.tabs.selectOwnerOnClose"
  await browser.tabs.update(tabs.D.id, { active: true });
  await wait(50);
  await browser.tabs.update(tabs.A.id, { active: true });
  await wait(50);
  await browser.tabs.update(tabs.D.id, { active: true });
  await wait(50);
  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, B, C, D, E } = tabs;
    is([
      `${A.id}`,
      `${A.id} => ${B.id}`,
      `${A.id} => ${B.id} => ${C.id}`,
      `${A.id} => ${D.id}`,
      `${E.id}`
    ], Utils.treeStructure([A, B, C, D, E]),
       'tabs must be initialized with specified structure');
    is([A.id, B.id, C.id, D.id, E.id],
       await Utils.tabsOrder([A, B, C, D, E]),
       'tabs must be initialized with specified order');
    is('D', await getActiveTabName(tabs),
       'the last descendant tab must be active');
  }

  await browser.tabs.remove(tabs.D.id);
  await wait(1000);

  is('C', await getActiveTabName(tabs),
     'new last descendant tab must be the successor.');
}

export async function testSimulateSelectOwnerOnClose() {
  await Utils.setConfigs({
    successorTabControlLevel: Constants.kSUCCESSOR_TAB_CONTROL_IN_TREE,
    simulateSelectOwnerOnClose: true
  });

  let tabs = await Utils.createTabs({
    A: { index: 1, active: true }
  });
  const childTabs = await Utils.createTabs({
    B: { index: 2, openerTabId: tabs.A.id, active: false },
    C: { index: 3, openerTabId: tabs.A.id, active: false }
  }, { windowId: win.id });
  tabs = await Utils.refreshTabs({ A: tabs.A, B: childTabs.B, C: childTabs.C });
  {
    const { A, B, C } = tabs;
    is([
      `${A.id}`,
      `${A.id} => ${B.id}`,
      `${A.id} => ${C.id}`
    ], Utils.treeStructure(Object.values(tabs)),
       'tabs must be initialized with specified structure');
    is('A', await getActiveTabName(tabs),
       'the opener tab must be active');
  }

  await browser.tabs.update(tabs.C.id, { active: true });
  await wait(150);
  await browser.tabs.remove(tabs.C.id);
  await wait(1000);

  is('A', await getActiveTabName(tabs),
     'the opener tab must be the successor.');
}

export async function testSimulateSelectOwnerOnCloseCleared() {
  await Utils.setConfigs({
    successorTabControlLevel: Constants.kSUCCESSOR_TAB_CONTROL_IN_TREE,
    simulateSelectOwnerOnClose: true
  });

  let tabs = await Utils.createTabs({
    A: { index: 1, active: true }
  });
  const childTabs = await Utils.createTabs({
    B: { index: 2, openerTabId: tabs.A.id, active: false },
    C: { index: 3, openerTabId: tabs.A.id, active: false }
  }, { windowId: win.id });
  tabs = await Utils.refreshTabs({ A: tabs.A, B: childTabs.B, C: childTabs.C });
  {
    const { A, B, C } = tabs;
    is([
      `${A.id}`,
      `${A.id} => ${B.id}`,
      `${A.id} => ${C.id}`
    ], Utils.treeStructure(Object.values(tabs)),
       'tabs must be initialized with specified structure');
    is('A', await getActiveTabName(tabs),
       'the opener tab must be active');
  }

  await browser.tabs.update(tabs.C.id, { active: true });
  await wait(50);
  await browser.tabs.update(tabs.B.id, { active: true });
  await wait(50);
  await browser.tabs.update(tabs.C.id, { active: true });
  await wait(50);
  await browser.tabs.remove(tabs.C.id);
  await wait(1000);

  is('B', await getActiveTabName(tabs),
     'the opener tab must not be the successor.');
}
