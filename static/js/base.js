AOS.init({
    duration: 1000,
    once: true
});

const byId = id => {
    return document.getElementById(id);
}

window.onclick = function(event) {
    if (event.target.matches(".open")) {
        byId("sidenav").classList.toggle("show");
    } else if (!(event.target.matches(".no-remove"))) {
        byId("sidenav").classList.remove("show")
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const drawer = document.querySelector('.drawer-wrapper');
    const openButton = document.getElementById('openDrawer');
    const closeButton = document.getElementById('closeDrawer');

    openButton.addEventListener('click', () => {
        drawer.classList.add('open');
    });

    closeButton.addEventListener('click', () => {
        drawer.classList.remove('open');
    });

    // Close drawer when clicking outside
    document.addEventListener('click', (e) => {
        if (drawer.classList.contains('open') && 
            !drawer.contains(e.target) && 
            !openButton.contains(e.target)) {
            drawer.classList.remove('open');
        }
    });
});
