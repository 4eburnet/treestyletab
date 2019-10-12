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
import * as TSTAPI from '/common/tst-api.js';
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


export async function testAutoFixupForHiddenTabs() {
  await Utils.setConfigs({
    fixupTreeOnTabVisibilityChanged: true,
    inheritContextualIdentityToNewChildTab: false,
    inheritContextualIdentityToSameSiteOrphan: false
  });

  let tabs;

  /*
  - A
    - B (with the "Personal" container)
      - C (with the "Personal" container)
        - D
          - E
    - F (with the "Personal" container)
      - G (with the "Personal" container)
    - H
  */
  tabs = await Utils.createTabs({
    A: { index: 1, cookieStoreId: 'firefox-default' },
    B: { index: 2, cookieStoreId: 'firefox-container-1', openerTabId: 'A' },
    C: { index: 3, cookieStoreId: 'firefox-container-1', openerTabId: 'B' },
    D: { index: 4, cookieStoreId: 'firefox-default', openerTabId: 'C' },
    E: { index: 5, cookieStoreId: 'firefox-default', openerTabId: 'D' },
    F: { index: 6, cookieStoreId: 'firefox-container-1', openerTabId: 'A' },
    G: { index: 7, cookieStoreId: 'firefox-container-1', openerTabId: 'F' },
    H: { index: 8, cookieStoreId: 'firefox-default', openerTabId: 'A' }
  }, { windowId: win.id });
  await wait(1000);

  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, B, C, D, E, F, G, H } = tabs;
    is([
      `${A.id}`,
      `${A.id} => ${B.id}`,
      `${A.id} => ${B.id} => ${C.id}`,
      `${A.id} => ${B.id} => ${C.id} => ${D.id}`,
      `${A.id} => ${B.id} => ${C.id} => ${D.id} => ${E.id}`,
      `${A.id} => ${F.id}`,
      `${A.id} => ${F.id} => ${G.id}`,
      `${A.id} => ${H.id}`
    ], Utils.treeStructure(Object.values(tabs)),
       'tabs must be initialized with specified structure');
    is([A.id, B.id, C.id, D.id, E.id, F.id, G.id, H.id],
       await Utils.tabsOrder([A, B, C, D, E, F, G, H]),
       'tabs must be initialized with specified order');

    await new Promise(resolve => {
      // wait until tabs are updated by TST
      let count = 0;
      const onUpdated = (tabId, changeInfo, _tab) => {
        if ('hidden' in changeInfo)
          count++;
        if (count == 4)
          resolve();
      };
      browser.tabs.onUpdated.addListener(onUpdated);
      browser.tabs.hide([B.id, C.id, F.id, G.id]);
    });
    await wait(1000);
  }

  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, B, C, D, E, F, G, H } = tabs;
    is([
      `${A.id}`,
      `${B.id}`,
      `${B.id} => ${C.id}`,
      `${A.id} => ${D.id}`,
      `${A.id} => ${D.id} => ${E.id}`,
      `${F.id}`,
      `${F.id} => ${G.id}`,
      `${A.id} => ${H.id}`
    ], Utils.treeStructure(Object.values(tabs)),
       'hidden tabs must be detached from the tree');

    await new Promise(resolve => {
      // wait until tabs are updated by TST
      let count = 0;
      const onUpdated = (tabId, changeInfo, _tab) => {
        if ('hidden' in changeInfo)
          count++;
        if (count == 4)
          resolve();
      };
      browser.tabs.onUpdated.addListener(onUpdated);
      browser.tabs.show([B.id, C.id, F.id, G.id]);
    });
    await wait(1000);
  }

  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, B, C, D, E, F, G, H } = tabs;
    is([
      `${A.id}`,
      `${A.id} => ${B.id}`,
      `${A.id} => ${B.id} => ${C.id}`,
      `${A.id} => ${D.id}`,
      `${A.id} => ${D.id} => ${E.id}`,
      `${A.id} => ${F.id}`,
      `${A.id} => ${F.id} => ${G.id}`,
      `${A.id} => ${H.id}`
    ], Utils.treeStructure(Object.values(tabs)),
       'shown tabs must be attached to the tree');
  }
}

export async function testCalculateNewTabPositionWithHiddenTabs() {
  let tabs = await Utils.createTabs({
    A: { index: 1 },
    B: { index: 2, active: true },
    C: { index: 3 }
  }, { windowId: win.id });
  await browser.tabs.hide([tabs.A.id]);
  await wait(1000);
  const childTabs = await Utils.createTabs({
    D: { openerTabId: tabs.B.id }
  }, { windowId: win.id });

  tabs = await Utils.refreshTabs({ B: tabs.B, C: tabs.C, D: childTabs.D });
  {
    const { B, C, D } = tabs;
    is([
      `${B.id}`,
      `${B.id} => ${D.id}`,
      `${C.id}`,
    ], Utils.treeStructure([B, D, C]),
       'new tab must be a child of the opener');
    is([B.id, D.id, C.id],
       await Utils.tabsOrder([B, C, D]),
       'new tab must be placed next to the opener');
  }
}

export async function testNewTabBeforeHiddenTab() {
  const tabs = await Utils.createTabs({
    A: { index: 0, active: true },
    B: { index: 1 }, // => hidden
    C: { index: 2 },
    D: { index: 3, openerTabId: 'C' },
    E: { index: 4, openerTabId: 'D' },
    F: { index: 5 }, // => hidden
    G: { index: 6 }
  }, { windowId: win.id });
  await browser.tabs.hide([tabs.B.id, tabs.F.id]);
  await wait(1000);

  async function assertNewTabOpenedAs(expectedIndex, baseTab, position) {
    const newTabs = await Utils.doAndGetNewTabs(async () => {
      await browser.runtime.sendMessage({
        type: Constants.kCOMMAND_SIMULATE_SIDEBAR_MESSAGE,
        message: {
          type:      Constants.kCOMMAND_NEW_TAB_AS,
          baseTabId: baseTab.id,
          as:        position
        }
      });
      await wait(1000);
    }, { windowId: win.id });
    is(1, newTabs.length, 'a new tab must be opened');
    is(expectedIndex, newTabs[0].index, 'a new tab must be placed before hidden tab');

    await browser.tabs.update(baseTab.id, { active: true });
    await browser.tabs.remove(newTabs[0].id);
    await wait(1000);
  }
  await assertNewTabOpenedAs(1, tabs.A, Constants.kNEWTAB_OPEN_AS_CHILD);
  await assertNewTabOpenedAs(1, tabs.A, Constants.kNEWTAB_OPEN_AS_NEXT_SIBLING);
  await assertNewTabOpenedAs(5, tabs.C, Constants.kNEWTAB_OPEN_AS_CHILD);
  await assertNewTabOpenedAs(5, tabs.C, Constants.kNEWTAB_OPEN_AS_NEXT_SIBLING);
}

export async function testMoveAttachedTabBeforeHiddenTab() {
  let tabs = await Utils.createTabs({
    A: { index: 0, active: true },
    B: { index: 1 }, // => hidden
    C: { index: 2 },
    D: { index: 3, openerTabId: 'C' },
    E: { index: 4, openerTabId: 'D' },
    F: { index: 5 }, // => hidden
    G: { index: 6 },
    H: { index: 7 },
    I: { index: 8 }
  }, { windowId: win.id });
  await browser.tabs.hide([tabs.B.id, tabs.F.id]);
  await wait(1000);

  await Utils.callAPI({
    type:   TSTAPI.kATTACH,
    parent: tabs.A.id,
    child:  tabs.H.id
  });
  await Utils.callAPI({
    type:   TSTAPI.kATTACH,
    parent: tabs.C.id,
    child:  tabs.I.id
  });
  await wait(500);

  tabs = await Utils.refreshTabs(tabs);
  is(tabs.A.index + 1, tabs.H.index, 'first child tab must be placed before hidden tab');
  is(tabs.E.index + 1, tabs.I.index, 'new child tab must be placed before hidden tab');
}
