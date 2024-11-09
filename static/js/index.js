const minDelay = 700;
const maxDelay = 900;

const minLetters = 10;
const maxLetters = 18;

const delay = 75;

const startAscii = 65;
const endAscii = 91;

const title = {
    "first-header": "SORT",
    "second-header": "VISUALIZER"
};

byId("header").onclick = headerAnimation;
headerAnimation();

function oneHeaderAnimation(whichId) {
    byId(whichId).innerHTML.split("").forEach( (item, i) => {
        letterAnimation(whichId, item, i);
    }
)}

function headerAnimation() {
    oneHeaderAnimation('first-header');
    oneHeaderAnimation('second-header');
}

async function letterAnimation(child, letter, i) {
    await sleep(Math.floor(Math.random() * minDelay) + maxDelay - minDelay);
    let rand = Math.floor(Math.random() * minLetters) + maxLetters - minLetters;
    let target = [];

    for (let k = 0; k < rand; k++) target.push(randomLetter());

    target.push(title[child][i]);

    for (let j = 0; j < target.length; j++) {
        changeLetter(child, target[j], i);
        await sleep(delay);
    }
}

function randomLetter() {
    return String.fromCharCode(startAscii + Math.floor(Math.random() * (endAscii - startAscii)));
}

function changeLetter(child, repl, i) {
    child = byId(child);
    let temp = child.innerHTML;
    child.innerHTML = temp.substr(0, i) + repl + temp.substr(i+1);
}

function sleep(delay) {
    return new Promise(resolve => {
        setTimeout(resolve, delay);
    });
}

document.addEventListener('DOMContentLoaded', function() {
    const title = document.querySelector('.hero-title');
    const words = document.querySelectorAll('.highlight, .visualizer');

    words.forEach(word => {
        word.addEventListener('mousemove', function(e) {
            const rect = word.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Calculate distance from center
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            // Move the word slightly towards cursor
            const moveX = (x - centerX) / 10;
            const moveY = (y - centerY) / 10;
            
            word.style.transform = `translate(${moveX}px, ${moveY}px) scale(1.05)`;
        });

        word.addEventListener('mouseleave', function() {
            word.style.transform = 'translate(0, 0) scale(1)';
        });
    });

    // Optional: Add ripple effect on click
    words.forEach(word => {
        word.addEventListener('click', function(e) {
            const ripple = document.createElement('div');
            ripple.classList.add('ripple');
            
            const rect = word.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;
            
            word.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
});
