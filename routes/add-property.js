app.post('/add-property', async (req, res) => {
  // Récupérer les données du formulaire depuis req.body
  const { numberOfRooms, surface, price, city, country } = req.body;

  try {
    // Créer une nouvelle propriété dans la base de données
    const property = new Property({
      numberOfRooms,
      surface,
      price,
      city,
      country
    });

    // Sauvegarder la propriété dans la base de données
    await property.save();

    // Rediriger vers une autre page ou envoyer une réponse JSON en cas de succès
    res.status(201).json({ message: 'Property added successfully' });
  } catch (error) {
    console.error('Error adding property', error);
    res.status(500).json({ error: 'An error occurred while adding the property' });
  }
});
