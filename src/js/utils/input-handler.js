export class InputHandler {
    constructor() {
        this.keys = {
            up: false,
            down: false,
            left: false,
            right: false,
            shoot: false,
            grenade: false,
        };

        this.mouse = {
            x: 0,
            y: 0,
            isDown: false
        };
        
        // Add debounce mechanism
        this.rightClickDebounce = false;
        this.rightClickDebounceTime = 800;
        this.lastRightClickTime = 0;
        this.rightClickMinInterval = 1000;

        // Get crosshair element
        this.crosshair = document.getElementById('crosshair');
        
        this.setupKeyListeners();
        this.setupMouseListeners();
    }

    setupKeyListeners() {
        window.addEventListener('keydown', (e) => {
            this.updateKey(e.key, true);
        });

        window.addEventListener('keyup', (e) => {
            this.updateKey(e.key, false);
        });
    }

    setupMouseListeners() {
        window.addEventListener('mousemove', (e) => {
            // Update normalized coordinates for game use
            this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            
            // Update crosshair position
            if (this.crosshair) {
                this.crosshair.style.left = `${e.clientX}px`;
                this.crosshair.style.top = `${e.clientY}px`;
                
                // Make sure crosshair is visible
                this.crosshair.style.display = 'block';
            }
        });

        window.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left click
                this.mouse.isDown = true;
                this.keys.shoot = true;
            } else if (e.button === 2) { // Right click for grenades
                this.keys.grenade = true;
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) { // Left click
                this.mouse.isDown = false;
                this.keys.shoot = false;
            } else if (e.button === 2) { // Right click
                setTimeout(() => {
                    this.keys.grenade = false;
                }, 50);
            }
        });

        // Prevent context menu on right click
        window.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    updateKey(key, isPressed) {
        switch(key) {
            case 'w':
            case 'ArrowUp':
                this.keys.up = isPressed;
                break;
            case 's':
            case 'ArrowDown':
                this.keys.down = isPressed;
                break;
            case 'a':
            case 'ArrowLeft':
                this.keys.left = isPressed;
                break;
            case 'd':
            case 'ArrowRight':
                this.keys.right = isPressed;
                break;
            case ' ':
                this.keys.shoot = isPressed;
                break;
            case 'g':
                this.keys.grenade = isPressed;
                break;
        }
    }
    
    // Update crosshair rotation to point in firing direction
    updateCrosshairRotation(playerRotation) {
        if (this.crosshair && playerRotation !== undefined) {
            // Convert player rotation to degrees and rotate the arrow
            // Player rotation is in radians, convert to degrees
            // Add 180 degrees to flip the arrow so white dot points outward (firing direction)
            const rotationDegrees = -(playerRotation * 180 / Math.PI) + 180;
            
            // Apply rotation to make arrow point in firing direction
            this.crosshair.style.transform = `translate(-50%, -50%) rotate(${rotationDegrees}deg)`;
        }
    }
} 