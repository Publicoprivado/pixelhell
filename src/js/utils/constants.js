export const COLORS = {
    PLAYER: 0x00ff00, // Bright green
    ENEMY: {
        REGULAR: 0xff0000, // Red
        CHUBBY: 0xff7700, // Orange
        THIN: 0x00ffff,   // Cyan instead of magenta
    },
    BULLET: 0xff00ff,     // Bright magenta for paintballs
    GRENADE: 0x000000,    // Black
    GUN: 0x8B4513,        // Brown
    GROUND: 0x222222,     // Dark gray (matches background)
    OBSTACLE: 0x222222,   // Darker gray
    AMMO: 0x0088ff,       // Light blue
    ENERGY: 0x22ff22,     // Bright green for energy pickups
};

export const SIZES = {
    PLAYER: 0.8,         // Taller player (increased from 0.5)
    BULLET: 0.15,         // Decreased for slimmer bullets (was 0.2)
    GRENADE: 0.15,        // Smaller grenades
    GRENADE_PICKUP: 0.35, // Larger pickup size for better visibility
    GUN: { WIDTH: 0.3, HEIGHT: 0.15, DEPTH: 0.15 }, // Larger gun
    ENEMIES: {
        REGULAR: 0.3,
        CHUBBY: 0.5,
        THIN: 0.2,
    },
};

export const GAME = {
    ARENA_SIZE: 60,
    CAMERA_HEIGHT: 20,
    CAMERA_ANGLE: Math.PI / 4, // 45 degrees
    
    // All speeds in units per second for consistent timing across hardware
    SPEEDS: {
        PLAYER: 8.0,              // Player movement (units per second)
        ENEMY: {
            REGULAR: 3.6,         // Regular enemy speed
            CHUBBY: 3.42,         // Chubby enemies are 70% of regular speed
            THIN: 3.18,          // Thin enemies are 30% of regular speed
        },
        BULLET: 40,              // Bullet travel speed 
        GRENADE: 0.55,           // Grenade throw speed
    },
    
    // Other game settings
    BULLET_MAX_DISTANCE: 75,   // Maximum distance bullets can travel (also controls splats)
    GRENADE_EXPLOSION_RADIUS: 4, // Explosion radius
    GRENADE_EXPLOSION_DELAY: 2000, // Milliseconds before explosion
    AMMO_COUNT: 15,            // Starting ammo (reduced from 30)
    RELOAD_TIME: 1000,         // Milliseconds to reload
    MAX_AMMO: 60,             // Maximum ammo capacity
    MAX_HEALTH: 100,           // Maximum player health
    MAX_ENERGY: 100,           // Maximum player energy
    ENERGY_AMOUNT: 20,         // Energy per pickup
    SPAWN_DELAY: 2000,         // Milliseconds between enemy spawns
    STEP_FREQUENCY: 6,         // Steps per second
    GRENADE_THROW_STRENGTH: 0.6, // Vertical throw strength
};

export const SOUNDS = {
    GUNSHOT: {
        type: 'hihat',
        options: { volume: -4 }
    },
    EXPLOSION: {
        type: 'tom',
        options: { volume: -5 }
    },
    RELOAD: {
        type: 'click',
        options: { volume: -15 }
    },
    PICKUP: {
        type: 'ping',
        options: { volume: -15 }
    },
    GRENADE_BOUNCE: {
        type: 'hihat',
        options: { volume: -15 }
    },
    GRENADE_EXPLOSION: {
        type: 'tom',
        options: { volume: 5 }
    },
    FOOTSTEP: {
        type: 'footstep',
        options: { volume: -15 }
    },
    DRY_FIRE: {
        type: 'click',
        options: { volume: -10 }
    }
}; 