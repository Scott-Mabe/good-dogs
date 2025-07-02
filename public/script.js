document.addEventListener('DOMContentLoaded', function() {
    const goodDogBtn = document.getElementById('good-dog-btn');
    const badDogBtn = document.getElementById('bad-dog-btn');
    const nextDogBtn = document.getElementById('next-dog-btn');
    const dogImage = document.getElementById('dog-image');
    const popupOverlay = document.getElementById('popup-overlay');
    const closePopupBtn = document.getElementById('close-popup');

    function showPopup() {
        popupOverlay.classList.add('show');
    }

    function hidePopup() {
        popupOverlay.classList.remove('show');
    }

    function loadNextDog() {
        dogImage.src = `/api/random-dog?t=${Date.now()}`;
    }

    function handleVote(isGoodDog) {
        if (!isGoodDog) {
            showPopup();
        } else {
            loadNextDog();
        }
        
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
    nextDogBtn.addEventListener('click', loadNextDog);
    closePopupBtn.addEventListener('click', () => {
        hidePopup();
        loadNextDog();
    });

    popupOverlay.addEventListener('click', (e) => {
        if (e.target === popupOverlay) {
            hidePopup();
            loadNextDog();
        }
    });

    loadNextDog();
});