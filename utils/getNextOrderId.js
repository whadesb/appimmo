const generateRandomOrderId = async () => {
    // Génère un nombre aléatoire entre 1000 et 9999
    const randomNumber = Math.floor(1000 + Math.random() * 9000);
    return `ORD-${randomNumber}`;
};

module.exports = generateRandomOrderId;
