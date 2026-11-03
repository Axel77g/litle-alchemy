// /?autoplay=… : le bot joue une partie neuve, sans accueil, introduction ni tutoriel (lu une fois : l'adresse ne change pas sans rechargement)
export const isAutoplay = new URLSearchParams(location.search).has('autoplay')
