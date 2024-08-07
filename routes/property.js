router.get('/edit-property/:id', async (req, res) => {
    try {
        const property = await Property.findById(req.params.id);
        if (property.createdBy.equals(req.user._id)) {
            if (property.status === 'draft') {
                res.render('edit-property', { property });
            } else {
                res.status(403).send('Vous ne pouvez pas modifier une propriété validée.');
            }
        } else {
            res.status(403).send('Vous n\'êtes pas autorisé à modifier cette propriété.');
        }
    } catch (error) {
        console.error('Error fetching property for editing', error);
        res.status(500).send('Une erreur est survenue lors de la récupération de la propriété.');
    }
});

router.post('/edit-property/:id', async (req, res) => {
    const { rooms, surface, price, city, country } = req.body;

    try {
        const property = await Property.findById(req.params.id);
        if (property.createdBy.equals(req.user._id) && property.status === 'draft') {
            property.rooms = rooms;
            property.surface = surface;
            property.price = price;
            property.city = city;
            property.country = country;

            await property.save();
            res.redirect('/user'); // Redirection vers la page utilisateur après modification
        } else {
            res.status(403).send('Modification non autorisée.');
        }
    } catch (error) {
        console.error('Error updating property', error);
        res.status(500).send('Une erreur est survenue lors de la mise à jour de la propriété.');
    }
});
