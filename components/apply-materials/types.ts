export type SceneControl = {
  enabled: boolean;
  value: number;
};

export type SceneControls = {
  weather: SceneControl;
  activity: SceneControl;
  timeOfDay: SceneControl;
  season: SceneControl;
  viewCharacter: SceneControl;
};

export type Project = {
  id: string;
  name: string;
  createdAt: string;
};

export type ImageSourceMode = 'upload' | 'project';
