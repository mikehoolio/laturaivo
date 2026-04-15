import Phaser from "phaser";
import * as utils from "../utils";

export class GameGuideScene extends Phaser.Scene {
  private uiContainer: Phaser.GameObjects.DOMElement | null = null;
  private isClosing: boolean = false;
  private previousScene: string = "TitleScreen";

  constructor() {
    super({ key: "GameGuideScene" });
  }

  init(data: { previousScene?: string }): void {
    this.isClosing = false;
    this.previousScene = data.previousScene || "TitleScreen";
  }

  create(): void {
    this.createBackground();
    this.createDOMUI();
    this.events.once("shutdown", () => this.cleanup());
  }

  private createBackground(): void {
    const overlay = this.add.rectangle(
      this.scale.width / 2,
      this.scale.height / 2,
      this.scale.width,
      this.scale.height,
      0x000000,
      0.88
    );
    overlay.setDepth(100);
  }

  private createDOMUI(): void {
    const uiHTML = `
      <div id="game-guide-container" class="absolute top-0 left-0 w-full h-full z-[1000] flex flex-col justify-start items-center overflow-hidden" style="font-family: 'PublicPixel';">
        <div class="w-full" style="padding-top: env(safe-area-inset-top, 16px);"></div>

        <div class="flex flex-col items-center gap-3 p-3 w-full max-w-3xl mx-auto flex-1 overflow-hidden">
          <div class="flex items-center justify-between w-full gap-2">
            <button id="guide-back-button" class="game-pixel-container-clickable-gray-600 px-4 py-3 cursor-pointer active:scale-95 transition-transform" style="min-height: 48px;">
              <span class="text-white text-sm font-bold" style="font-family: 'PublicPixel';">⬅️ TAKAISIN</span>
            </button>
            <div class="text-cyan-300 text-xs md:text-sm" style="font-family: 'PublicPixel'; text-shadow: 1px 1px 0px #000;">
              LATURAIVO OHJEET
            </div>
          </div>

          <div class="text-center">
            <div class="text-yellow-400 font-bold text-2xl md:text-3xl" style="text-shadow: 3px 3px 0px #000000;">
              📘 LUE PELIN OHJEET
            </div>
            <div class="text-white text-xs md:text-sm mt-1" style="text-shadow: 1px 1px 0px #000;">
              Kaikki tärkeimmät toiminnot yhdessä näkymässä
            </div>
          </div>

          <div id="guide-scroll" class="game-pixel-container-gray-800 p-3 w-full flex-1 overflow-y-auto" style="min-height: 320px; max-height: 520px; -webkit-overflow-scrolling: touch;">
            <div class="flex flex-col gap-3 text-left">
              <section class="game-pixel-container-blue-800 p-3">
                <h3 class="text-yellow-300 text-sm md:text-base font-bold mb-1">PERUSOHJAUS</h3>
                <p class="text-white text-xs md:text-sm leading-relaxed">Liiku vasemman alakulman ohjaimella. Hyppy, sauvaisku, voltti, kirves ja raivo löytyvät oikean puolen napeista tason mukaan.</p>
              </section>

              <section class="game-pixel-container-green-800 p-3">
                <h3 class="text-yellow-300 text-sm md:text-base font-bold mb-1">TAISTELU</h3>
                <p class="text-white text-xs md:text-sm leading-relaxed">Sauvaisku toimii nopeana lähihyökkäyksenä. Kirves tekee kovaa vahinkoa, mutta kuluttaa energiaa. Voltti osuu lähialueelle ja auttaa väistöissä.</p>
              </section>

              <section class="game-pixel-container-purple-700 p-3">
                <h3 class="text-yellow-300 text-sm md:text-base font-bold mb-1">ENERGIA JA RAIVO</h3>
                <p class="text-white text-xs md:text-sm leading-relaxed">Energia palautuu ajan myötä. Laturaivo avautuu varhain kampanjassa ja antaa hetkeksi suuren voimapurkauksen tavallisia vihollisia vastaan.</p>
              </section>

              <section class="game-pixel-container-red-800 p-3">
                <h3 class="text-yellow-300 text-sm md:text-base font-bold mb-1">SUPERIT (HOLD)</h3>
                <p class="text-white text-xs md:text-sm leading-relaxed">Kun superit avautuvat, pidä nappia noin 1 sekunti pohjassa: Myrskyvoltti ja Supersauva kestävät noin 2 sekuntia. Myöhemmin Supersyöksy kirveellä avautuu korkeammalla tasolla.</p>
              </section>

              <section class="game-pixel-container-orange-700 p-3">
                <h3 class="text-yellow-300 text-sm md:text-base font-bold mb-1">BOSSITAISTELUT</h3>
                <p class="text-white text-xs md:text-sm leading-relaxed">Bossit vaihtavat vaihetta ja hyökkäysrytmiä. Väistä erikoisiskujen varoitukset ja käytä superit silloin kun bossi sitoutuu pitkään animaatioon.</p>
              </section>

              <section class="game-pixel-container-gray-700 p-3">
                <h3 class="text-yellow-300 text-sm md:text-base font-bold mb-1">POWER-UPIT JA ELÄMÄ</h3>
                <p class="text-white text-xs md:text-sm leading-relaxed">Poimi kentän power-upit tilanteen mukaan. Bossifighteissa onnistuneet osumat ja stompit voivat palauttaa terveyttä, joten pysy hyökkäävänä mutta hallittuna.</p>
              </section>

              <section class="game-pixel-container-cyan-900 p-3">
                <h3 class="text-yellow-300 text-sm md:text-base font-bold mb-1">VINKIT PIKAAN</h3>
                <p class="text-white text-xs md:text-sm leading-relaxed">Pidä vauhti yllä, vältä turhat osumat ja käytä pausea jos ruutu menee sekavaksi. Jos ääni joskus katkeaa iOS:llä, pause -> resume käynnistää musiikin uudelleen.</p>
              </section>
            </div>
          </div>
        </div>

        <div class="w-full" style="padding-bottom: env(safe-area-inset-bottom, 16px);"></div>

        <style>
          #guide-scroll::-webkit-scrollbar {
            width: 4px;
          }
          #guide-scroll::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.25);
          }
          #guide-scroll::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.35);
            border-radius: 2px;
          }
        </style>
      </div>
    `;

    this.uiContainer = utils.initUIDom(this, uiHTML);
    this.uiContainer.setDepth(101);

    this.time.delayedCall(50, () => {
      this.attachButtonListeners();
    });
  }

  private attachButtonListeners(): void {
    const backButton = this.uiContainer?.node?.querySelector("#guide-back-button") as HTMLElement | null;
    if (!backButton) return;

    backButton.addEventListener("click", (e) => {
      e.stopPropagation();
      this.goBack();
    });
    backButton.addEventListener("touchend", (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.goBack();
    }, { passive: false });
  }

  private goBack(): void {
    if (this.isClosing) return;
    this.isClosing = true;

    this.sound.play("ui_click_sound", { volume: 0.3 });
    this.cleanup();
    this.scene.stop();

    if (this.previousScene && this.scene.isPaused(this.previousScene)) {
      this.scene.resume(this.previousScene);
    }
  }

  private cleanup(): void {
    // Reserved for future listener teardown.
  }
}
