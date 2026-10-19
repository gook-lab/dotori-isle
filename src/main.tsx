import { HALL_SITE } from './core/hall'
import { HALL_OBJECTS, HALL_ROOM } from './core/interior'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { getLayout } from './core/daily'
import { beachDecor } from './core/beach'
import { TIDE_POOLS } from './core/tidepool'
import { DOCKS, MAILBOX, ROCKS, SHOP, SHOP_DOOR, STALL, TREES } from './core/world'
import { HOME_SITE } from './core/home'
import { HOME_ROOM, roomCenter } from './core/interior'
import { MARKET_SITE } from './core/market'
import { MUSEUM_SITE } from './core/museum'
import { INFRA_BOARD } from './core/infra'
import { VIEWPOINT } from './core/viewpoint'
import { FESTIVALS, FESTIVAL_DAY } from './core/festivals'
import { VILLAGERS, villagerPosition } from './core/villagers'
import { SCENERY } from './core/scenery'
import { worldUniforms } from './scene/worldFx'
import { runtime } from './game/runtime'
import { findAction } from './game/actions'
import { gainMileToast, useGame } from './game/store'
import './styles.css'
import { bubbleSpots } from './core/diving'
import { sheltersNow, sneezing } from './core/weatherLife'
import { placeBlocker } from './core/placement'
import { heightAt, groundAt } from './core/island'
import { pathCellsOf } from './core/paths'
import { onBridge } from './core/waters'
import { SONGI_SITE } from './core/songiSite'
import { setDevCamFreeze } from './scene/Player'

// 개발 서버에서만 브라우저 자동화가 상태를 읽고 플레이어를 옮길 수 있게 연다.
if (import.meta.env.DEV) Object.assign(window, { __dotori: { ledger: () => useGame.getState().salesLedger ?? [], camFreeze: setDevCamFreeze, gainMileToast, HALL_SITE, HALL_ROOM, HALL_OBJECTS, SONGI_SITE, runtime, useGame, findAction, TREES, ROCKS, SHOP_DOOR, VILLAGERS, DOCKS, STALL, MAILBOX, getLayout, villagerPosition, SCENERY, worldUniforms, SHOP, HOME_SITE, HOME_ROOM, roomCenter, MARKET_SITE, MUSEUM_SITE, INFRA_BOARD, VIEWPOINT, FESTIVALS, FESTIVAL_DAY, beachDecor, TIDE_POOLS, bubbleSpots, sheltersNow, sneezing, placeBlocker, heightAt, groundAt, pathCellsOf, onBridge } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
