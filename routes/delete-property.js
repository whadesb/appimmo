// routes/delete-property.js
const express = require('express');
const router = express.Router();
const Property = require('../models/Property');
const authMiddleware = require('../middleware/auth'); // Importer le middleware d'authentification

router.delete('/delete-property/:id', authMiddleware, async (req, res) => {
  const propertyId = req.params.id;

  try {
    const property = await Property.findOneAndDelete({ _id: propertyId, owner: req.session.user._id });
    if (!property) {
      return res.status(404).json({ error: 'Propriété non trouvée ou vous n\'êtes pas autorisé à la supprimer.' });
    }
    res.status(200).json({ message: 'Propriété supprimée avec succès.' });
  } catch (error) {
    console.error('Erreur lors de la suppression de la propriété : ', error);
    res.status(500).json({ error: 'Une erreur est survenue lors de la suppression de la propriété.' });
  }
});

module.exports = router;
