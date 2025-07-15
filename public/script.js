document.addEventListener('DOMContentLoaded', function() {
    const goodDogBtn = document.getElementById('good-dog-btn');
    const badDogBtn = document.getElementById('bad-dog-btn');
    const dogImage = document.getElementById('dog-image');
    const popupOverlay = document.getElementById('popup-overlay');
    const popupMessage = document.getElementById('popup-message');
    const closePopupBtn = document.getElementById('close-popup');

    // Accessibility: Close popup on Escape key
    document.addEventListener('keydown', function(e) {
        if (popupOverlay.classList.contains('show') && e.key === 'Escape') {
            hidePopup();
        }
    });

    function showPopup(message) {
        popupMessage.textContent = message;
        popupOverlay.classList.add('show');
        closePopupBtn.focus(); // Accessibility: focus close button
    }

    function hidePopup() {
        popupOverlay.classList.remove('show');
        loadNextDog();
    }

    // Preload next dog image for smoother transitions
    let nextDogNum = Math.floor(Math.random() * 10) + 1;
    let nextDogImg = new Image();
    nextDogImg.src = `/images/dog${nextDogNum}.jpg`;

    function loadNextDog() {
        // Use preloaded image if available
        dogImage.src = `${nextDogImg.src}?t=${Date.now()}`;
        // Preload the next image
        nextDogNum = Math.floor(Math.random() * 10) + 1;
        nextDogImg = new Image();
        nextDogImg.src = `/images/dog${nextDogNum}.jpg`;
    }

    function handleVote(isGoodDog) {
        const message = isGoodDog ? 
            'Correct! This is a Good Dog.' : 
            'Correct! This is a Good Dog. All dogs are Good Dogs.';
        showPopup(message);
        fetch('/api/vote', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                vote: isGoodDog ? 'good' : 'bad',
                timestamp: new Date().toISOString()
            })
        }).catch(err => {
            // User feedback on error
            showPopup('Sorry, there was a problem recording your vote.');
        });
    }

    // Robustness: Check elements before adding listeners
    if (goodDogBtn) goodDogBtn.addEventListener('click', () => handleVote(true));
    if (badDogBtn) badDogBtn.addEventListener('click', () => handleVote(false));
    if (closePopupBtn) closePopupBtn.addEventListener('click', hidePopup);
    if (popupOverlay) {
        popupOverlay.addEventListener('click', (e) => {
            if (e.target === popupOverlay) {
                hidePopup();
            }
        });
    }

    loadNextDog();
});