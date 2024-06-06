module.exports = (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).send('Vous devez être connecté pour accéder à cette ressource.');
    }
    next();
  };
  