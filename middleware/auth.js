// Fichier : middleware/auth.js (CORRECTION)

// Middleware pour vérifier si l'utilisateur est authentifié
function isAuthenticated(req, res, next) {
    // 🔑 CORRECTION : Vérifie si la méthode existe ET l'appelle.
    if (req.isAuthenticated && req.isAuthenticated()) { 
        return next(); // Authentifié, on continue
    }
    
    // Si l'authentification échoue ou n'est pas initialisée, on redirige.
    // Tente de récupérer la locale du paramètre d'URL, puis de req.locale, sinon 'fr'.
    const locale = req.params.locale || req.locale || 'fr'; 
    
    return res.redirect(`/${locale}/login`); 
}

module.exports = isAuthenticated;
