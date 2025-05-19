/**
 * TimeManager - Utility for consistent time-based movement across different hardware
 * 
 * This manager ensures that game movement and animations are consistent
 * regardless of the device's performance or frame rate.
 */
export class TimeManager {
    constructor() {
        // Target frame rate for reference
        this.targetFPS = 60;
        
        // Fixed time step for consistent physics/movement
        this.fixedDeltaTime = 1 / this.targetFPS;
        
        // Cap maximum delta time to prevent huge jumps when tab is inactive or FPS drops severely
        this.maxDeltaTime = this.fixedDeltaTime * 3; // Cap at 3 frames worth of time
        
        // Time scaling factor (can be used to slow down or speed up the game)
        this.timeScale = 1.0;
        
        // Accumulated time for fixed time step calculations
        this.accumulator = 0;
        
        // The last time getDeltaTime was called
        this.lastTime = performance.now() / 1000;
    }
    
    /**
     * Process and return a capped delta time
     * @param {number} rawDeltaTime - The raw delta time from the game loop
     * @returns {number} - The processed delta time
     */
    getDeltaTime(rawDeltaTime) {
        // Cap delta time to prevent huge jumps
        const cappedDelta = Math.min(rawDeltaTime, this.maxDeltaTime);
        
        // Apply time scale (allows for slowing/speeding up game)
        return cappedDelta * this.timeScale;
    }
    
    /**
     * Get delta time automatically using performance.now()
     * @returns {number} - The processed delta time
     */
    getAutoDeltatime() {
        const currentTime = performance.now() / 1000;
        const rawDeltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        return this.getDeltaTime(rawDeltaTime);
    }
    
    /**
     * Get the fixed delta time for operations that need fixed time step simulation
     * @returns {number} - The fixed delta time
     */
    getFixedDeltaTime() {
        return this.fixedDeltaTime * this.timeScale;
    }
    
    /**
     * Update the accumulator for fixed time step simulations
     * @param {number} deltaTime - The delta time to add to the accumulator
     * @returns {number} - The number of fixed steps to take
     */
    updateFixedTimeStep(deltaTime) {
        this.accumulator += deltaTime;
        const steps = Math.floor(this.accumulator / this.fixedDeltaTime);
        this.accumulator -= steps * this.fixedDeltaTime;
        return steps;
    }
    
    /**
     * Set the time scale factor
     * @param {number} scale - The time scale factor (1.0 = normal, 0.5 = half speed, 2.0 = double speed)
     */
    setTimeScale(scale) {
        // Clamp between reasonable values (0.1 to 2.0)
        this.timeScale = Math.max(0.1, Math.min(2.0, scale));
    }
    
    /**
     * Reset the accumulator and time tracking
     */
    reset() {
        this.accumulator = 0;
        this.lastTime = performance.now() / 1000;
    }
}

// Create a singleton instance for use throughout the game
export const timeManager = new TimeManager(); 