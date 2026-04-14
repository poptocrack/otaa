// Colors
export const WIREFRAME_GREEN = '#00ff00';
export const WIREFRAME_RED = '#ff3333';
export const WIREFRAME_YELLOW = '#ffff00';
export const WIREFRAME_CYAN = '#00ffff';
export const BG_BLACK = '#000000';

// Terrain
export const GRID_SIZE = 200; // size of visible grid
export const GRID_DIVISIONS = 40;
export const CHUNK_SIZE = 80; // obstacle chunk size
export const OBSTACLE_VIEW_RANGE = 3; // chunks visible in each direction

// Player
export const PLAYER_SPEED = 12;
export const PLAYER_ROTATION_SPEED = 1.5;
export const PLAYER_MAX_HEALTH = 120;
export const PLAYER_FIRE_RATE = 1; // seconds between auto-shots

// Projectiles
export const PROJECTILE_SPEED = 60;
export const PROJECTILE_LIFETIME = 3; // seconds
export const PROJECTILE_DAMAGE = 25;

// Enemies
export const ENEMY_SPEED = 4;
export const ENEMY_FIRE_RATE = 2.5; // seconds between shots
export const ENEMY_HEALTH = 25;
export const ENEMY_DAMAGE = 8;
export const ENEMY_SPAWN_DISTANCE = 80;
export const ENEMY_AGGRO_RANGE = 50;
export const ENEMY_PROJECTILE_SPEED_MULT = 0.45; // slower enemy projectiles

// Waves
export const WAVE_BASE_ENEMIES = 3;
export const WAVE_ENEMY_INCREMENT = 2;
export const WAVE_SPAWN_INTERVAL = 1.5; // seconds between spawns

// XP
export const XP_PER_KILL = 25;
export const XP_PER_LEVEL = 100;
