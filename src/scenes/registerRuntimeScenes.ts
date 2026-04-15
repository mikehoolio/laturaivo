import Phaser from "phaser";

type SceneType = Phaser.Types.Scenes.SceneType;

let runtimeSceneRegistration: Promise<void> | null = null;

const hasScene = (game: Phaser.Game, key: string): boolean => {
  const manager: any = game.scene;
  return !!manager?.keys?.[key];
};

const addSceneIfMissing = (game: Phaser.Game, key: string, sceneType: SceneType): void => {
  if (hasScene(game, key)) return;
  game.scene.add(key, sceneType, false);
};

export const registerRuntimeScenes = (game: Phaser.Game): Promise<void> => {
  if (runtimeSceneRegistration) return runtimeSceneRegistration;

  runtimeSceneRegistration = (async () => {
    const [
      { UberIntroScene },
      { SplashScene },
      { TitleScreen },
      { GameGuideScene },
      { NameInputScene },
      { StoryScene },
      { GameScene },
      { default: UIScene },
      { TutorialUIScene },
      { AbilityUnlockUIScene },
      { VictoryUIScene },
      { VictoryCutsceneScene },
      { GameCompleteUIScene },
      { CreditsScreen },
      { GameOverUIScene },
      { LeaderboardUIScene }
    ] = await Promise.all([
      import("./UberIntroScene"),
      import("./SplashScene"),
      import("./TitleScreen"),
      import("./GameGuideScene"),
      import("./NameInputScene"),
      import("./StoryScene"),
      import("./GameScene"),
      import("./UIScene"),
      import("./TutorialUIScene"),
      import("./AbilityUnlockUIScene"),
      import("./VictoryUIScene"),
      import("./VictoryCutsceneScene"),
      import("./GameCompleteUIScene"),
      import("./CreditsScreen"),
      import("./GameOverUIScene"),
      import("./LeaderboardUIScene")
    ]);

    addSceneIfMissing(game, "UberIntroScene", UberIntroScene);
    addSceneIfMissing(game, "SplashScene", SplashScene);
    addSceneIfMissing(game, "TitleScreen", TitleScreen);
    addSceneIfMissing(game, "GameGuideScene", GameGuideScene);
    addSceneIfMissing(game, "NameInputScene", NameInputScene);
    addSceneIfMissing(game, "StoryScene", StoryScene);
    addSceneIfMissing(game, "GameScene", GameScene);
    addSceneIfMissing(game, "UIScene", UIScene);
    addSceneIfMissing(game, "TutorialUIScene", TutorialUIScene);
    addSceneIfMissing(game, "AbilityUnlockUIScene", AbilityUnlockUIScene);
    addSceneIfMissing(game, "VictoryUIScene", VictoryUIScene);
    addSceneIfMissing(game, "VictoryCutsceneScene", VictoryCutsceneScene);
    addSceneIfMissing(game, "GameCompleteUIScene", GameCompleteUIScene);
    addSceneIfMissing(game, "CreditsScreen", CreditsScreen);
    addSceneIfMissing(game, "GameOverUIScene", GameOverUIScene);
    addSceneIfMissing(game, "LeaderboardUIScene", LeaderboardUIScene);
  })().catch((error) => {
    runtimeSceneRegistration = null;
    throw error;
  });

  return runtimeSceneRegistration;
};
