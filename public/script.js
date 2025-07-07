document.addEventListener('DOMContentLoaded', function() {
    const goodDogBtn = document.getElementById('good-dog-btn');
    const badDogBtn = document.getElementById('bad-dog-btn');
    const dogImage = document.getElementById('dog-image');
    const popupOverlay = document.getElementById('popup-overlay');
    const popupMessage = document.getElementById('popup-message');
    const closePopupBtn = document.getElementById('close-popup');

    function showPopup(message) {
        popupMessage.textContent = message;
        popupOverlay.classList.add('show');
    }

    function hidePopup() {
        popupOverlay.classList.remove('show');
        loadNextDog();
    }

    function loadNextDog() {
        dogImage.src = `/api/random-dog?t=${Date.now()}`;
    }

    function handleVote(isGoodDog) {
        const message = isGoodDog ? 
            'Correct this is a good dog.' : 
            'Correct this is a Good Dog. All dogs are Good Dogs.';
        
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
        }).catch(err => console.log('Vote recording failed:', err));
    }

    goodDogBtn.addEventListener('click', () => handleVote(true));
    badDogBtn.addEventListener('click', () => handleVote(false));
    closePopupBtn.addEventListener('click', hidePopup);

    popupOverlay.addEventListener('click', (e) => {
        if (e.target === popupOverlay) {
            hidePopup();
        }
    });

    loadNextDog();
});