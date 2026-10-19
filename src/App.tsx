import { Canvas, useThree } from '@react-three/fiber'
import { PCFShadowMap } from 'three'
import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { startMusicLoop } from './game/music'
import { useGame } from './game/store'
import { Bugs } from './scene/Bugs'
import { Companion } from './scene/Companion'
import { Snowman } from './scene/Snowman'
import { TreasureGlint } from './scene/Treasure'
import { Diving } from './scene/Diving'
import { FishShadows } from './scene/FishShadows'
import { Footprints } from './scene/Footprints'
import { Puddles } from './scene/Puddles'
import { PhotoCam } from './scene/PhotoCam'
import { PhotoMode } from './ui/Photo'
import { useQuality } from './game/quality'
import { Interior } from './scene/Interior'
import { Soundscape } from './scene/Soundscape'
import { Dust } from './scene/Dust'
import { Effects } from './scene/Effects'
import { Landmarks } from './scene/Landmarks'
import { DigSpots, Garden, Rocks } from './scene/Fields'
import { Houses } from './scene/Houses'
import { Particles } from './scene/Particles'
import { PlacedFurniture, PlacementGhost } from './scene/Furniture'
import { IslandGifts } from './scene/IslandGifts'
import { GardenRange } from './scene/GardenRange'
import { PlaceTap } from './scene/PlaceTap'
import { Decor, Terrain, Water } from './scene/Island'
import { CaveRoom } from './scene/Cave'
import { Balloon } from './scene/Balloon'
import { Discoveries } from './scene/Discoveries'
import { Fireflies } from './scene/Fireflies'
import { MorningNews } from './ui/MorningNews'
import { StoryBanner } from './ui/StoryBanner'
import { Epilogue } from './ui/Epilogue'
import { Bobber, Player } from './scene/Player'
import { Pickups, Shop, Trees } from './scene/Props'
import { Scenery } from './scene/Scenery'
import { Sky } from './scene/Sky'
import { Villagers } from './scene/Villagers'
import { Waters } from './scene/Waters'
import { WeatherFx } from './scene/Weather'
import { CatchCaption, DialogBox } from './ui/Dialog'
import { Hud, TalkFrame, Toast, TravelFade } from './ui/Hud'
import { ShakeHintBubble } from './ui/ShakeHint'
import { RoomSetChip } from './ui/RoomSets'
import { TouchTip } from './ui/TouchTip'
import { Title } from './ui/Title'
import { TitleCam } from './scene/TitleCam'
import { ShakeHintTracker } from './scene/ShakeHint'
import { PhonePanel } from './ui/Phone'
import { FestivalScene } from './scene/Festival'
import { SkyEvents } from './scene/SkyEvents'
import { MarketStall } from './scene/Market'
import { Announcer } from './scene/Announcer'
import { HomeExterior, HomeInterior } from './scene/Home'
import { MuseumExterior, MuseumInterior } from './scene/Museum'
import { ShopInterior } from './scene/ShopInterior'
import { HallExterior, HallInterior } from './scene/Hall'
import { StreetLamps } from './scene/StreetLamps'
import { PumpkinLanterns } from './scene/PumpkinLanterns'
import { isIndoor } from './game/indoor'
import { InfraPanel } from './ui/Infra'
import { CalendarPanel } from './ui/Calendar'
import { TourneyBar } from './ui/TourneyBar'
import { DexPanel, QuestPanel, ShopPanel } from './ui/Panels'
import { TouchControls } from './ui/TouchControls'
import { devParam } from './core/devParam'
// 처음 화면에 필요 없는 패널은 열 때 따로 불러온다(첫 로딩 번들을 줄인다)
const SettingsPanel = lazy(() => import('./ui/Settings').then((m) => ({ default: m.SettingsPanel })))
const WorldMap = lazy(() => import('./ui/WorldMap').then((m) => ({ default: m.WorldMap })))
const CraftPanel = lazy(() => import('./ui/Workshop').then((m) => ({ default: m.CraftPanel })))
const MilesPanel = lazy(() => import('./ui/Workshop').then((m) => ({ default: m.MilesPanel })))
const CookPanel = lazy(() => import('./ui/Cook').then((m) => ({ default: m.CookPanel })))
const ClosetPanel = lazy(() => import('./ui/Closet').then((m) => ({ default: m.ClosetPanel })))
const MailPanel = lazy(() => import('./ui/Closet').then((m) => ({ default: m.MailPanel })))
const AtmPanel = lazy(() => import('./ui/Bank').then((m) => ({ default: m.AtmPanel })))
const IslandGiftPanel = lazy(() => import('./ui/IslandGiftPanel').then((m) => ({ default: m.IslandGiftPanel })))
const HomePanel = lazy(() => import('./ui/HomePanel').then((m) => ({ default: m.HomePanel })))
const StoragePanel = lazy(() => import('./ui/HomePanel').then((m) => ({ default: m.StoragePanel })))
const MarketPanel = lazy(() => import('./ui/Market').then((m) => ({ default: m.MarketPanel })))
const SongiPanel = lazy(() => import('./ui/Songi').then((m) => ({ default: m.SongiPanel })))
const FestivalPanel = lazy(() => import('./ui/Festival').then((m) => ({ default: m.FestivalPanel })))
const MuseumPanel = lazy(() => import('./ui/Museum').then((m) => ({ default: m.MuseumPanel })))
const TourneyPanel = lazy(() => import('./ui/Tourney').then((m) => ({ default: m.TourneyPanel })))
const DesignPanel = lazy(() => import('./ui/Design').then((m) => ({ default: m.DesignPanel })))
const HomeScorePanel = lazy(() => import('./ui/HomeScore').then((m) => ({ default: m.HomeScorePanel })))

/** 지연 로드 패널을 기다리는 동안의 자리: 같은 가운데 창 틀을 먼저 그려 깜빡임과 창 크기 변화를 줄인다. */
function PanelPlaceholder() {
  return (
    <div className="backdrop" aria-busy="true">
      <div className="panel tall" />
    </div>
  )
}

/** 집·전시관·동굴 안에 있으면 섬 바깥 것을 통째로 숨긴다. 방 밖 메시를 매 프레임 훑고 자르는 비용을 없앤다. */
function Outdoors({ children }: { children: ReactNode }) {
  const indoor = useGame((s) => isIndoor(s))
  return <group visible={!indoor}>{children}</group>
}

/** 그림자 켜기·끄기를 렌더러에 바로 건다. Canvas 의 shadows 는 처음 값만 믿을 수 있어서 함께 맞춘다. */
function QualityBridge({ shadows }: { shadows: boolean }) {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    gl.shadowMap.enabled = shadows
    gl.shadowMap.needsUpdate = true
  }, [gl, shadows])
  return null
}

export function App() {
  const panel = useGame((s) => s.panel)
  const { profile } = useQuality()
  // DEV 전용 ?shadows=0: 그림자를 끄고 줄무늬 원인(그림자 얼룩 여부)을 가린다. 운영에서는 devParam 이 null 이라 영향이 없다.
  const shadows = profile.shadows && devParam('shadows') !== '0'
  const photo = useGame((s) => s.photo)
  const title = useGame((s) => s.title)
  // 에필로그 동안에는 HUD·토스트·말풍선을 모두 숨긴다(타이틀과 같은 방식)
  const ending = useGame((s) => s.storyEnding !== null)

  // 배경음은 첫 입력 뒤에 소리가 난다. 루프는 한 번만 켠다.
  useEffect(() => {
    startMusicLoop()
  }, [])
  useEffect(() => {
    const s = useGame.getState()
    s.syncClock()
    const id = setInterval(() => useGame.getState().syncClock(), 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <>
      <Canvas dpr={profile.dpr} shadows={shadows ? { type: PCFShadowMap } : false} camera={{ fov: 40, position: [0, 13, 14], near: 0.1, far: 300 }}>
        <QualityBridge shadows={shadows} />
        <Sky />
        <SkyEvents />
        <Outdoors>
          <Terrain />
          <Water />
          <Waters />
          <Footprints />
          <Puddles />
          <Diving />
          <Decor />
          <Trees />
          <Scenery />
          <Shop />
          <MarketStall />
          <FestivalScene />
          <HomeExterior />
          <MuseumExterior />
          <HallExterior />
          <StreetLamps />
          <PumpkinLanterns />
          <Pickups />
          <Bugs />
          <FishShadows />
          <Rocks />
          <DigSpots />
          <Garden />
          <Houses />
          <Landmarks />
          <Balloon />
          <Discoveries />
          <Fireflies />
        </Outdoors>
        <Companion />
        <Snowman />
        <TreasureGlint />
        <PhotoCam />
        <Announcer />
        <HomeInterior />
        <MuseumInterior />
        <ShopInterior />
        <HallInterior />
        <CaveRoom />
        <PlacedFurniture />
        <IslandGifts />
        <PlacementGhost />
        <GardenRange />
        <PlaceTap />
        <Villagers />
        <Player />
        <TitleCam />
        <ShakeHintTracker />
        <Bobber />
        <Dust />
        <Particles />
        <Effects />
        <WeatherFx />
        <Soundscape />
        <Interior />
      </Canvas>
      {!ending && <TalkFrame />}
      {!photo && !title && !ending && <Hud />}
      {!photo && !title && !ending && <TourneyBar />}
      {!photo && !title && !ending && <Toast />}
      {!title && !ending && <MorningNews />}
      {!title && !ending && <StoryBanner />}
      {!title && <Epilogue />}
      {!title && !ending && <PhotoMode />}
      {panel === 'shop' && <ShopPanel />}
      {panel === 'dex' && <DexPanel />}
      {panel === 'talk' && <DialogBox />}
      {!panel && !title && !ending && <CatchCaption />}
      {panel === 'quest' && <QuestPanel />}
      {panel === 'phone' && <PhonePanel />}
      {panel === 'infra' && <InfraPanel />}
      {panel === 'calendar' && <CalendarPanel />}
      <Suspense fallback={<PanelPlaceholder />}>
        {panel === 'map' && <WorldMap />}
        {panel === 'craft' && <CraftPanel />}
        {panel === 'cook' && <CookPanel />}
        {panel === 'miles' && <MilesPanel />}
        {panel === 'closet' && <ClosetPanel />}
        {panel === 'mail' && <MailPanel />}
        {panel === 'atm' && <AtmPanel />}
        {panel === 'gift' && <IslandGiftPanel />}
        {panel === 'home' && <HomePanel />}
        {panel === 'storage' && <StoragePanel />}
        {panel === 'market' && <MarketPanel />}
        {panel === 'songi' && <SongiPanel />}
        {panel === 'festival' && <FestivalPanel />}
        {panel === 'museum' && <MuseumPanel />}
        {panel === 'tourney' && <TourneyPanel />}
        {panel === 'design' && <DesignPanel />}
        {panel === 'homeScore' && <HomeScorePanel />}
        {panel === 'settings' && <SettingsPanel />}
      </Suspense>
      <TravelFade />
      {!title && !ending && <TouchControls />}
      {!title && !ending && <ShakeHintBubble />}
      {!title && !ending && <RoomSetChip />}
      {!title && !ending && <TouchTip />}
      <Title />
    </>
  )
}
