const fs = require('fs');
const path = require('path');

// Function to read the confirmation email HTML template
const readConfirmationEmailTemplate = () => {
  const filePath = path.join(__dirname, '../templatesemails/confirmation_inscription.html');
  return fs.readFileSync(filePath, 'utf-8');
};

// Route pour traiter la soumission du formulaire d'inscription
router.post('/register', async (req, res) => {
  const { email, firstName } = req.body;

  try {
    // Vérification de l'existence de l'utilisateur
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.send('Un utilisateur avec cet e-mail existe déjà.');
    }

    // Création d'un nouvel utilisateur
    const user = new User({ email, firstName });
    await user.save();

    // Envoi de l'e-mail de confirmation
    const confirmationEmailTemplate = readConfirmationEmailTemplate(); // Lecture du modèle HTML
    await transporter.sendMail({
      from: 'communication@zebrito.fr',
      to: email,
      subject: 'Confirmation d\'inscription',
      html: confirmationEmailTemplate.replace('[Votre entreprise]', 'UAP Immo')
    });

    // Redirection vers la page de connexion après l'inscription
    res.redirect('/login');
  } catch (error) {
    console.error('Erreur lors de l\'inscription de l\'utilisateur', error);
    res.send('Une erreur est survenue lors de l\'inscription.');
  }
});
