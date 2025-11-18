// middleware/auth.js

// Middleware pour vérifier si l'utilisateur est authentifié
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();  // Si l'utilisateur est authentifié, passe à la route suivante
    }
    res.redirect('/login');  // Sinon, redirige vers la page de connexion
}

module.exports = isAuthenticated;
