class QuickSortVisualizer {
    constructor() {
        this.array = [];
        this.arrayContainer = document.getElementById('arrayContainer');
        this.arraySize = document.getElementById('arraySize');
        this.sortingSpeed = document.getElementById('sortingSpeed');
        this.setupEventListeners();
        this.generateArray();
    }

    setupEventListeners() {
        document.getElementById('generateNewArray').addEventListener('click', () => this.generateArray());
        document.getElementById('startSort').addEventListener('click', () => this.startSort());
        document.getElementById('pauseSort').addEventListener('click', () => this.pauseSort());
        document.getElementById('resetSort').addEventListener('click', () => this.resetSort());
        
        this.arraySize.addEventListener('input', () => {
            document.getElementById('arraySizeValue').textContent = this.arraySize.value;
            this.generateArray();
        });
        
        this.sortingSpeed.addEventListener('input', () => {
            document.getElementById('speedValue').textContent = this.sortingSpeed.value;
        });
    }

    generateArray() {
        this.array = [];
        const size = parseInt(this.arraySize.value);
        for (let i = 0; i < size; i++) {
            this.array.push(Math.floor(Math.random() * 100) + 1);
        }
        this.updateVisualization();
    }

    updateVisualization(comparing = [], pivot = null, sorted = []) {
        this.arrayContainer.innerHTML = '';
        const maxValue = Math.max(...this.array);
        
        this.array.forEach((value, index) => {
            const bar = document.createElement('div');
            bar.className = 'array-bar';
            bar.style.height = `${(value / maxValue) * 100}%`;
            
            if (comparing.includes(index)) {
                bar.classList.add('comparing');
            } else if (index === pivot) {
                bar.classList.add('pivot');
            } else if (sorted.includes(index)) {
                bar.classList.add('sorted');
            }
            
            this.arrayContainer.appendChild(bar);
        });
    }

    async startSort() {
        // Implement QuickSort algorithm with visualization
        // This is a simplified version - you'll need to implement the full algorithm
        document.getElementById('startSort').disabled = true;
        document.getElementById('pauseSort').disabled = false;
        
        // Reset counters
        document.getElementById('comparisonCount').textContent = '0';
        document.getElementById('swapCount').textContent = '0';
        document.getElementById('timeElapsed').textContent = '0.00s';
        
        // Start timer
        const startTime = Date.now();
        
        // Update timer every 100ms
        const timerInterval = setInterval(() => {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            document.getElementById('timeElapsed').textContent = `${elapsed}s`;
        }, 100);
        
        // Implement QuickSort here
        // ...
        
        // Cleanup
        clearInterval(timerInterval);
        document.getElementById('startSort').disabled = false;
        document.getElementById('pauseSort').disabled = true;
    }

    pauseSort() {
        // Implement pause functionality
    }

    resetSort() {
        this.generateArray();
        document.getElementById('startSort').disabled = false;
        document.getElementById('pauseSort').disabled = true;
        document.getElementById('comparisonCount').textContent = '0';
        document.getElementById('swapCount').textContent = '0';
        document.getElementById('timeElapsed').textContent = '0.00s';
    }
}

// Initialize the visualizer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new QuickSortVisualizer();
}); 