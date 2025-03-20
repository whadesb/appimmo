<!doctype html>
<html lang="<%= locale %>">
<head>
    <meta charset="utf-8">
<!-- Google Tag Manager -->
<script>
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id=' + i + dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-TF7HSC3N');
</script>
<!-- Fin Google Tag Manager -->
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#C4B990">
    <title>UAP Immo | <%= i18n.my_profile %></title>
    <link href="/css/bootstrap.min.css" rel="stylesheet">
    <link href="/css/bootstrap-icons.css" rel="stylesheet">
    <link rel="preload" href="/css/styles-main.css" as="style">
    <link rel="stylesheet" href="/css/styles-main.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.1.1/css/all.min.css">
    <style>
        html, body {
            height: 100%;
        }
        body {
            display: flex;
            flex-direction: column;
            font-family: 'Arial', sans-serif;
            background-color: #f8f9fa;
            margin: 0;
        }
        h3 {
            color: #000;
            text-align: left;
        }
        .navbar {
            background-color: #C4B990;
            margin-bottom: 20px;
        }
        .navbar .navbar-brand, .navbar .nav-link, .navbar .navbar-icon {
            color: #000;
        }
        .navbar .navbar-icon {
            color: #000;
        }
        .main-section {
            flex: 1;
            padding: 20px;
            background-color: #fff;
            margin-left: 10px;
            min-height: 500px;
        }
        .main-section .card {
            border: none;
            box-shadow: none;
        }
.progress {
    background-color: #d7d7d7 !important; 
    width: 7.6rem;
}

   .sidebar {
            background-color: #8f97c4;
            border-radius: 60px;
            box-shadow: 2px 2px 2px rgba(0, 0, 0, 0.8);
            padding: 20px;
            width: 60px;
            height: auto;
            display: flex;
            flex-direction: column;
            align-items: center;
            position: sticky;
            top: 20px;
        
        }
        .sidebar a {
            margin: 10px 0;
            color: #000;
            font-size: 24px;
            text-decoration: none;
        }
        .sidebar a:hover {
            color: #000;
        }
.tooltip-container {
    position: relative;
    display: inline-block;
    cursor: help;
}

.tooltip-text {
    visibility: hidden;
    width: 200px;
    background-color: rgba(0, 0, 0, 0.8);
    color: #fff;
    text-align: center;
    padding: 8px;
    border-radius: 5px;
    position: absolute;
    z-index: 10;
    bottom: 120%;
    left: 50%;
    transform: translateX(-50%);
    opacity: 0;
    transition: opacity 0.3s ease-in-out, transform 0.3s ease-in-out;
    font-size: 14px;
    line-height: 1.4;
    white-space: nowrap;
}

/* Flèche sous l'infobulle */
.tooltip-text::after {
    content: "";
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-width: 5px;
    border-style: solid;
    border-color: rgba(0, 0, 0, 0.8) transparent transparent transparent;
}

/* Affichage de l'infobulle au survol */
.tooltip-container:hover .tooltip-text {
    visibility: visible;
    opacity: 1;
    transform: translateX(-50%) translateY(-5px);
}


        .footer {
            background-color: #343a40;
            color: #fff;
            padding: 20px 0;
        }
        .btn-custom {
            background-color: #8f97c4;
            color: #000;
            border: none;
        }
        .btn-custom:hover {
            background-color: #8f97c4;
            color: #000;
        }
        .btn-custom i {
            font-size: 24px;
        }
        .tooltip {
            position: absolute;
            background-color: #ADD8E6;
            color: #000;
            padding: 5px 10px;
            border-radius: 4px;
            white-space: nowrap;
            z-index: 1000;
            top: -30px;
            left: 50%;
            transform: translateX(-50%);
        }
        .copy-message {
            display: none;
            background-color: #d1e7dd;
            color: #0f5132;
            padding: 10px;
            border-radius: 5px;
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 1000;
        }
        .action-icons i {
            font-size: 24px;
            cursor: pointer;
            margin-right: 10px;
            color: #333;
        }
        .short-column {
            width: 10%;
        }
        .card-title {
            font-weight: 400;
            font-size: 1.6rem;
            color: #000;
            margin-bottom: 0.5rem;
        }
        .card-text {
            font-size: 1.1rem;
            line-height: 1.8rem;
            color: #666;
            margin-bottom: 1rem;
            letter-spacing: 0.5px;
        }
        .card-body .user-info {
            color: #333;
            margin-bottom: 0.2rem;
            line-height: 1.6rem;
        }
.hidden {
    display: none;
}


/* Couleurs dynamiques selon les jours restants */
.progress-bar.green { background-color: #8BC34A !important; }  /* ✅ Vert */
.progress-bar.orange { background-color: #FFC107 !important; } /* ✅ Orange */
.progress-bar.red { background-color: #FF5722 !important; }    /* ✅ Rouge */


input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
}
input[type="number"] {
    -moz-appearance: textfield;
}
.form-group {
    margin-bottom: 15px;
}

.form-group label {
    color: #333;
    display: block;
    margin-bottom: 5px;
}

.form-control {
    width: 50%;
    padding: 10px;
    font-size: 16px;
    border: 1px solid #8f97c4;
    border-radius: 5px;
    transition: border 0.3s ease-in-out;
}

/* Effet focus */
.form-control:focus {
    border-color: #8f97c4; /* Bleu */
    outline: none;
    box-shadow: 0 0 5px rgba(143, 151, 196, 0.5);
}




        @media (max-width: 767px) {
            .container-fluid {
                padding-left: 0;
                padding-right: 0;
            }
            .container {
                padding-left: 15px;
                padding-right: 15px;
            }
            .row {
                flex-direction: column;
                align-items: center;
            }
            .main-section {
                margin-left: 0;
                margin-right: 0;
                margin-top: 0;
                width: 100%;
                border-radius: 0;
                box-shadow: none;
                min-height: 300px;
                overflow-x: auto;
                padding-left: 0;
                padding-right: 0;
            }
            .sidebar {
                display: none;
            }
            .sidebar-mobile-links {
                display: block !important;
                margin-top: 10px;
            }
            .mobile-margin {
                margin-top: 30px;
            }
            table {
                width: 100%;
                table-layout: auto;
            }
            th, td {
                white-space: nowrap;
                padding: 8px;
                text-align: left;
            }
            .table-responsive {
                display: block;
                width: 100%;
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
            }
            #landing .form-group {
                width: 100%;
                padding: 5px;
            }
            #landing .form-control {
                width: 100%;
                padding: 10px;
                font-size: 16px;
            }
            #landing button.btn-custom {
                width: 100%;
                padding: 10px;
                font-size: 18px;
            }
            .card-title {
                font-weight: 400;
                font-size: 1.4rem;
                color: #000;
                margin-bottom: 0.5rem;
            }
            .card-text {
                font-size: 1.1rem;
                line-height: 1.8rem;
                color: #666;
                margin-bottom: 1rem;
                letter-spacing: 0.5px;
            }
            .card-body .user-info {
                color: #333;
                margin-bottom: 0.2rem;
                line-height: 1.2rem;
            }
.hidden {
    display: none;
}


progress {
    width: 100%;
    height: 10px;
    margin-top: 5px;
background-color: #d9d9d9 !important;
}
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
}
input[type="number"] {
    -moz-appearance: textfield;
}

        }
        @media (min-width: 768px) {
            .sidebar-links {
                display: none;
            }
            .card-title {
                font-size: 1.475rem;
                font-weight: 400;
                color: #000;
            }
            .card-text {
                font-size: 1rem;
                line-height: 1.6rem;
                letter-spacing: 0.4px;
            }
.hidden {
    display: none;
}

progress {
    width: 100%;
    height: 10px;
    margin-top: 5px;
}
        }
    </style>
</head>
<body id="top">

<noscript>
  <iframe src="https://www.googletagmanager.com/ns.html?id=GTM-TF7HSC3N"
  height="0" width="0" style="display:none;visibility:hidden"></iframe>
</noscript>
    <main>
      <body id="top">
    <main>
       <nav class="navbar navbar-expand-lg fixed-top">
    <div class="container">
        <a class="navbar-brand" href="/">
            <span>UAP Immo</span>
        </a>
        <div class="d-lg-none ms-auto me-4">
            <% if (user) { %>
                <form action="/<%= locale %>/logout" method="POST" class="d-inline" onsubmit="event.preventDefault(); window.location.href = '/<%= locale %>/login';">
    <button type="submit" style="background: none; border: none; position: relative;">
        <i class="bi bi-person-circle" style="font-size: 1.8rem; color: black;"></i>
        <i class="bi bi-x-circle" style="font-size: 0.8rem; color: red; position: absolute; top: 0; right: 0;"></i>
        <span class="visually-hidden"><%= i18n.menu.logout %></span>
    </button>
</form>
            <% } else { %>
                <a href="/login" style="position: relative;">
                    <i class="bi bi-person-circle" style="font-size: 1.8rem; color: black;"></i>
                    <span class="visually-hidden"><%= i18n.menu.login %></span>
                </a>
            <% } %>
        </div>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
            <ul class="navbar-nav ms-lg-5 me-lg-auto">
                <li class="nav-item">
                    <a class="nav-link click-scroll" href="/"><%= i18n.menu.home %></a>
                </li>
              
                <li class="nav-item">
                    <a class="nav-link click-scroll" href="/#contact"><%= i18n.menu.contact %></a>
                </li>
                <!-- Sidebar links for mobile -->
                <li class="nav-item sidebar-mobile-links sidebar-links">
                    <a class="nav-link click-scroll" href="#" onclick="showSection('account')"><i class="fa fa-user"></i> <%= i18n.my_profile %></a>
                </li>
                <li class="nav-item sidebar-mobile-links sidebar-links">
                    <a class="nav-link click-scroll" href="#" onclick="showSection('landing')"><i class="fa fa-file-alt"></i> <%= i18n.add_property %></a>
                </li>
                <li class="nav-item sidebar-mobile-links sidebar-links">
                    <a class="nav-link click-scroll" href="#" onclick="showSection('donnees')"><i class="fa-solid fa-chart-line"></i> <%= i18n.stats %></a>
                </li>
                <li class="nav-item sidebar-mobile-links sidebar-links">
                    <a class="nav-link click-scroll" href="#" onclick="showSection('created-pages')"><i class="fa fa-wallet"></i> <%= i18n.created_pages %></a>
                </li>
                <li class="nav-item sidebar-mobile-links sidebar-links">
                    <a class="nav-link click-scroll" href="#" onclick="showSection('orders')"><i class="fa fa-shopping-cart"></i> <%= i18n.my_orders %></a>
                </li>

            </ul>
            <div class="d-none d-lg-block">
                <% if (user) { %>
                    <form action="/<%= locale %>/logout" method="POST" class="d-inline" onsubmit="event.preventDefault(); window.location.href = '/<%= locale %>/login';">
    <button type="submit" style="background: none; border: none; position: relative;">
        <i class="bi bi-person-circle" style="font-size: 1.8rem; color: black;"></i>
        <i class="bi bi-x-circle" style="font-size: 0.8rem; color: red; position: absolute; top: 0; right: 0;"></i>
        <span class="visually-hidden"><%= i18n.menu.logout %></span>
    </button>
</form>
                <% } else { %>
                    <a href="/login" style="position: relative;">
                        <i class="bi bi-person-circle" style="font-size: 1.8rem; color: black;"></i>
                        <span class="visually-hidden"><%= i18n.menu.login %></span>
                    </a>
                <% } %>
            </div>
        <div class="dropdown d-none d-lg-block ms-3">
                <button class="btn btn-link dropdown-toggle" type="button" id="languageDropdown" data-bs-toggle="dropdown" aria-expanded="false" style="text-decoration: none; color: #000;">
                    <%= locale === 'fr' ? 'FR' : 'EN' %>
                </button>
                <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="languageDropdown">
                    <li>
                        <a class="dropdown-item" href="/fr/login">FR</a>
                    </li>
                    <li>
                        <a class="dropdown-item" href="/en/login">EN</a>
                    </li>
                </ul>
            </div>
        </div>
    </div>
        </div>
    </div>
</nav>

<section class="contact-section section-padding section-bg" id="section_5">
    <div class="container">
        <h5 class="text-black mobile-margin">
            <% if (user) { %>
                <%= i18n.welcome_user.replace('{lastName}', user.lastName).replace('{firstName}', user.firstName) %>
            <% } else { %>
                <%= i18n.welcome_guest %>
            <% } %>
        </h5>
        <div class="container-fluid">
            <div class="row mt-4">
                <div class="col-auto p-0">
                    <div class="sidebar">
                        <a href="#" title="<%= i18n.my_profile %>" onclick="showSection('account')"><i class="fa fa-user"></i></a>
                        <a href="#" title="<%= i18n.add_property %>" onclick="showSection('landing')"><i class="fa fa-file-alt"></i></a>
                        <a href="#" title="<%= i18n.stats %>" onclick="showSection('donnees')"><i class="fa-solid fa-chart-line"></i></a>
                        <a href="#" title="<%= i18n.created_pages %>" onclick="showSection('created-pages')"><i class="fa fa-wallet"></i></a>
<a href="#" title="Mes commandes" onclick="showSection('orders')"><i class="fa fa-shopping-cart"></i></a>
                    </div>
                </div>
                <div class="col">
                    <div class="main-section">
                        <!-- Section Account -->
                        <div id="account" class="card">
                            <div class="card-body">
                                <h5 class="card-title"><%= i18n.my_profile %></h5>
                                <p class="card-text"><%= i18n.profile_info %></p>
                                <p class="card-text user-info"><%= i18n.name %>: <%= user.firstName %></p>
                                <p class="card-text user-info"><%= i18n.first_name %>: <%= user.lastName %></p>
                                <p class="card-text user-info"><%= i18n.email %>: <%= user.email %></p>

                                <!-- Bouton qui montre la section de réinitialisation du mot de passe -->
                                <button type="button" class="btn btn-outline-dark" onclick="showSection('reset-password')"><%= i18n.reset_password %></button>
                            </div>
                        </div>

                        <!-- Section Reset Password -->
                        <div id="reset-password" class="card" style="display: none;">
                            <div class="card-body">
                                <h5 class="card-title"><%= i18n.reset_password %></h5>
                                <p class="card-text"><%= i18n.password_reset_instructions %></p>
                                <form id="reset-password-form" action="/user/reset-password" method="POST">
                                    <div class="form-group">
                                        <label for="email"><%= i18n.email_label %></label>
                                        <input type="email" class="form-control" id="email" name="email" required>
                                    </div>
                                    <button type="submit" class="btn btn-outline-dark"><%= i18n.send_reset_link %></button>
                                </form>
                            </div>
                        </div>

                        <!-- Section Landing Page -->
                        <div id="landing" class="card" style="display: none;">
                            <div class="card-body">
                                <h5 class="card-title"><%= i18n.add_property %></h5>
                                <p class="card-text"><%= i18n.property_details %></p>
                                <h5 class="card-title"><%= i18n.add_property %></h5>
                                <form id="add-property-form" action="/add-property" method="POST" enctype="multipart/form-data">
  <input type="hidden" id="userId" name="userId" value="<%= user._id %>">
  <div class="form-group">
    <label for="rooms"><%= i18n.rooms %></label>
    <input type="number" class="form-control" id="rooms" name="rooms" required>
  </div>
  <div class="form-group">
    <label for="bedrooms">Nombre de chambres</label>
    <input type="number" class="form-control" id="bedrooms" name="bedrooms" required>
  </div>
  <div class="form-group">
    <label for="surface"><%= i18n.surface %> :</label>
    <input type="number" class="form-control" id="surface" name="surface" required>
  </div>
  <div class="form-group">
    <label for="price"><%= i18n.price %> :</label>
    <input type="number" class="form-control" id="price" name="price" required>
  </div>
   <div class="form-group">
    <label for="country"><%= i18n.country %> :</label>
    <input type="text" class="form-control" id="country" name="country" required>
  </div>

  <div class="form-group">
    <label for="city"><%= i18n.city %> :</label>
    <input type="text" class="form-control" id="city" name="city" required>
  </div>

  <!-- Année de construction -->
  <div class="form-group">
    <label for="yearBuilt">Année de construction</label>
    <input type="number" class="form-control" id="yearBuilt" name="yearBuilt">
  </div>
  <!-- Piscine -->
  <div class="form-group">
    <label for="pool">Piscine</label>
    <select class="form-control" id="pool" name="pool">
      <option value="false">Non</option>
      <option value="true">Oui</option>
    </select>
  </div>
  <!-- Type de bien -->
  <div class="form-group">
    <label for="propertyType"><%= i18n.propertyType %>Type de bien :</label>
    <select class="form-control" id="propertyType" name="propertyType" required>
      
      <option value="Propriété"><%= i18n.property %>Propriété</option>
      <option value="Villa"><%= i18n.villa %>Villa</option>
      <option value="Hôtel particulier"><%= i18n.hotel_particulier %>Hotel particulier</option>
      <option value="Appartement"><%= i18n.apartment %>Appartement</option>
      <option value="Chateau"><%= i18n.chateau %>Chateau</option>
      <option value="Maison"><%= i18n.house %>Maison de ville</option>
    </select>
  </div>
<div class="form-group">
    <label for="bathrooms">Salles de douche</label>
    <input type="number" class="form-control" id="bathrooms" name="bathrooms">
  </div>
  <div class="form-group">
    <label for="toilets">Toilettes</label>
    <input type="number" class="form-control" id="toilets" name="toilets">
  </div>
  <div class="form-group">
    <label for="elevator">Ascenseur</label>
    <select class="form-control" id="elevator" name="elevator">
      <option value="false">Non</option>
      <option value="true">Oui</option>
    </select>
  </div>
  <div class="form-group">
    <label for="fireplace">Cheminée</label>
    <select class="form-control" id="fireplace" name="fireplace">
      <option value="false">Non</option>
      <option value="true">Oui</option>
    </select>
  </div>
  <div class="form-group">
    <label for="internet">Internet</label>
    <select class="form-control" id="internet" name="internet">
      <option value="false">Non</option>
      <option value="true">Oui</option>
    </select>
  </div>
  <div class="form-group">
    <label for="doubleGlazing">Double vitrage</label>
    <select class="form-control" id="doubleGlazing" name="doubleGlazing">
      <option value="false">Non</option>
      <option value="true">Oui</option>
    </select>
  </div>
  <div class="form-group">
    <label for="wateringSystem">Arrosage</label>
    <select class="form-control" id="wateringSystem" name="wateringSystem">
      <option value="false">Non</option>
      <option value="true">Oui</option>
    </select>
  </div>
  <div class="form-group">
    <label for="barbecue">Barbecue</label>
    <select class="form-control" id="barbecue" name="barbecue">
      <option value="false">Non</option>
      <option value="true">Oui</option>
    </select>
  </div>
  <div class="form-group">
    <label for="carShelter">Abri de voiture</label>
    <select class="form-control" id="carShelter" name="carShelter">
      <option value="false">Non</option>
      <option value="true">Oui</option>
    </select>
  </div>
  <div class="form-group">
    <label for="parking">Parking</label>
    <select class="form-control" id="parking" name="parking">
      <option value="false">Non</option>
      <option value="true">Oui</option>
    </select>
  </div>
  <div class="form-group">
    <label for="caretakerHouse">Maison de gardien</label>
    <select class="form-control" id="caretakerHouse" name="caretakerHouse">
      <option value="false">Non</option>
      <option value="true">Oui</option>
    </select>
  </div>
  <div class="form-group">
    <label for="electricShutters">Stores électriques</label>
    <select class="form-control" id="electricShutters" name="electricShutters">
      <option value="false">Non</option>
      <option value="true">Oui</option>
    </select>
  </div>
  <div class="form-group">
    <label for="outdoorLighting">Éclairage extérieur</label>
    <select class="form-control" id="outdoorLighting" name="outdoorLighting">
      <option value="false">Non</option>
      <option value="true">Oui</option>
    </select>
  </div>
 <div class="form-group">
    <label for="photo1"><%= i18n.photo_1 %></label>
    <input type="file" class="form-control" id="photo1" name="photo1" accept="image/*" required>
    <progress id="progress1" value="0" max="100" class="hidden"></progress>
    <span id="status1" class="hidden">Chargement...</span>
</div>

<div class="form-group">
    <label for="photo2"><%= i18n.photo_2 %></label>
    <input type="file" class="form-control" id="photo2" name="photo2" accept="image/*" required>
    <progress id="progress2" value="0" max="100" class="hidden"></progress>
    <span id="status2" class="hidden">Chargement...</span>
</div>

<div class="form-group">
    <label for="description"><%= i18n.description %> (max. 820 caractères)</label>
    <textarea class="form-control" id="description" name="description" rows="5" maxlength="820" required></textarea>
    <small id="charCount">0/820 <%= i18n.characters %></small>
  </div>
  <button type="submit" class="btn btn-custom"><%= i18n.save %></button>
</form>

                                <div id="generatedLink" class="mt-3"></div>
                            </div>
                        </div>

                        <!-- Section Données -->
                        <div id="donnees" class="card" style="display: none;">
                            <div class="card-body">
                                <h5 class="card-title"><%= i18n.stats %></h5>
                                <p class="card-text">Cette section vous permet de suivre la performance de vos annonces immobilières sur les différentes plateformes de diffusion. Consultez les statistiques détaillées pour évaluer la visibilité de vos annonces sur Facebook, Ads by UAP, ECA-N, et Google.</p>
                            <table class="table table-striped">
    <thead>
        <tr>
            <th>Page</th>
            <th>Vues</th>
            <th>Utilisateurs</th>
            <th>Source de trafic</th>
            <th>Medium</th>
            <th>Pays</th>
            <th>Ville</th>
            <th>Type d'appareil</th>
        </tr>
    </thead>
    <tbody id="stats-list">
        <!-- Les stats seront chargées ici -->
    </tbody>
</table>



</div>
                        </div>
<div id="orders" class="card" style="display: none;">
  <div class="card-body">
    <h5 class="card-title">Mes commandes</h5>
    <p class="card-text">Liste des commandes passées</p>
    <table class="table table-striped">
    <thead>
  <tr>
    <th>Order ID</th>
    <th>Date</th>
    <th>Status</th>
    <th class="tooltip-container">
      Jours restants
      <span class="tooltip-text">Durée restante de validité du pack</span>
    </th>
    <th>Expiration Date</th>
    <th>Actions</th>
  </tr>
</thead>


<tbody id="orders-list">
  <!-- Contenu dynamique chargé via JS -->
</tbody>
    </table>
    <div id="no-orders-message" style="display: none;" class="text-center">
      <p>Aucune commande trouvée.</p>
    </div>
  </div>
</div>

                        <!-- Section Created Pages -->
                        <div id="created-pages" class="card" style="display: none;">
    <div class="card-body">
        <h5 class="card-title"><%= i18n.created_pages %></h5>
        <p class="card-text"><%= i18n.created_pages_info %></p>
       <table class="table table-striped">
    <thead>
        <tr>
            <th scope="col">Pièces</th>
            <th scope="col">Surface</th>
            <th scope="col">Prix</th>
            <th scope="col">Ville</th>
            <th scope="col">Pays</th>
            <th scope="col">URL</th>
            <th scope="col">Actions</th>
        </tr>
    </thead>
    <tbody id="properties-list">
        <!-- Les propriétés créées par l'utilisateur seront affichées ici -->
    </tbody>
</table>
<div id="no-properties-message" style="display: none;" class="text-center">
    <p>Aucune landing page trouvée.</p>
</div>


                            </div>
                        </div>

                    </div> <!-- Fin de main-section -->
                </div>
            </div>
        </div>
    </div>
</section>
</main>
    <footer class="site-footer section-padding">
        <div class="container">
            <div class="row">
                <div class="col-lg-3 col-12 mb-4 pb-2">
                    <a class="navbar-brand mb-2" href="/">
                        <span>UAP Immo</span>
                    </a>
                </div>
                <div class="col-lg-3 col-md-4 col-6">
                    <h6 class="site-footer-title mb-3"><%= i18n.footer.information_title %></h6>
                    <ul class="site-footer-links">
                        <li class="site-footer-link-item"><a href="/" class="site-footer-link"><%= i18n.menu.home %></a></li>
                        <li class="site-footer-link-item"><a href="/register" class="site-footer-link"><%= i18n.footer.create_account %></a></li>
                    </ul>
                </div>
                <div class="col-lg-3 col-md-4 col-6">
                    <h6 class="site-footer-title mb-3"><%= i18n.footer.access_title %></h6>
                    <ul class="site-footer-links">
                        <li class="site-footer-link-item"><a href="/contact" class="site-footer-link"><%= i18n.menu.contact %></a></li>
                    </ul>
                </div>
                <div class="col-lg-3 col-md-4 col-12 mt-4 mt-lg-0 ms-auto">
                    <div class="dropdown">
                        <button class="btn btn-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false"></button>
                        <ul class="dropdown-menu">
                            <li>
                                <a class="dropdown-item" href="/en/user">English</a>
                            </li>
                            <li>
                                <a class="dropdown-item" href="/fr/user">Français</a>
                            </li>
                        </ul>
                    </div>
                </div>
                <p class="copyright-text mt-lg-5 mt-4">Copyright © 2025 UAP Company. All rights reserved.</p>
            </div>
        </div>
    </footer>
<div class="copy-message" id="copyMessage">URL copiée avec succès !</div>

<!-- JavaScript -->
<script src="/jquery-3.6.0.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.0/dist/js/bootstrap.bundle.min.js" integrity="sha384-U1DAWAznBHeqEIlVSCgzq+c9gqGAJn5c/t99JyeKa9xxaYpSvHU5awsuZVVFIhvj" crossorigin="anonymous"></script>
<script>
    function showSection(sectionId) {
        const sections = ['account', 'landing', 'donnees', 'created-pages', 'reset-password'];
        sections.forEach(id => {
            const sectionElement = document.getElementById(id);
            if (sectionElement) {
                sectionElement.style.display = id === sectionId ? 'block' : 'none';
            }
        });

        if (sectionId === 'created-pages') {
            loadProperties();
        }
    }

    async function loadProperties() {
    try {
        const response = await fetch('/user/properties');
        if (response.ok) {
            const properties = await response.json();
            const propertiesList = document.getElementById('properties-list');
            propertiesList.innerHTML = '';

            const noPropertiesMessage = document.getElementById('no-properties-message');
            if (properties.length === 0) {
                noPropertiesMessage.style.display = 'block';
            } else {
                noPropertiesMessage.style.display = 'none';
                properties.forEach(property => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${property.rooms}</td>
                        <td>${property.surface}</td>
                        <td>${property.price.toLocaleString('fr-FR')} €</td>
                        <td>${property.city}</td>
                        <td>${property.country}</td>
                        <td><a href="${property.url}" target="_blank">${property.url}</a></td>
                        <td>
                            <div class="action-icons">
                                <i class="bi bi-clipboard" style="color: #333;" onclick="copyURL('${property.url}')"></i>
                                <i class="fa fa-shopping-cart" style="color: #333;" onclick="testURL('${property._id}')"></i>
                                <i class="fa fa-pencil-alt" style="color: #333;" onclick="editProperty('${property._id}')"></i>
                            </div>
                        </td>
                    `;
                    propertiesList.appendChild(row);
                });
            }
        } else {
            const propertiesList = document.getElementById('properties-list');
            propertiesList.innerHTML = '<tr><td colspan="7" class="text-center">Erreur lors du chargement des propriétés.</td></tr>';
        }
    } catch (error) {
        const propertiesList = document.getElementById('properties-list');
        propertiesList.innerHTML = '<tr><td colspan="7" class="text-center">Une erreur est survenue lors du chargement des propriétés.</td></tr>';
    }
}


    function copyURL(url) {
        const fullUrl = `https://uap.immo${url}`;
        navigator.clipboard.writeText(fullUrl)
            .then(() => {
                showCopyMessage();
            })
            .catch(err => {
                console.error('Impossible de copier l\'URL : ', err);
            });
    }

    function showCopyMessage() {
        const copyMessage = document.getElementById('copyMessage');
        copyMessage.style.display = 'block';
        setTimeout(() => {
            copyMessage.style.display = 'none';
        }, 2000);
    }

function testURL(propertyId) {
    console.log("🔍 ID de la propriété cliqué :", propertyId);

    // Récupération de la langue à partir de l'URL actuelle
    const currentLang = window.location.pathname.split('/')[1]; // 'en' ou 'fr'

    // Vérifier que currentLang est bien 'en' ou 'fr', sinon rediriger sans préfixe de langue
    if (currentLang === 'en' || currentLang === 'fr') {
        window.location.href = `/${currentLang}/payment?propertyId=${propertyId}`;
    } else {
        window.location.href = `/payment?propertyId=${propertyId}`;
    }
}

    function editProperty(propertyId) {
        window.location.href = `/property/edit/${propertyId}`;
    }
document.getElementById('add-property-form').addEventListener('submit', async function(event) {
  event.preventDefault();
  const formData = new FormData(this);

  try {
    const response = await fetch('/add-property', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.text();  // Récupérer la réponse sous forme de texte HTML
    document.getElementById('generatedLink').innerHTML = result;  // Afficher le message sous le formulaire
  } catch (error) {
    console.error('Erreur lors de l\'ajout de la propriété :', error);
  }
});


    // Temps en millisecondes (5 minutes)
    const inactivityTime = 5 * 60 * 1000;
    let timeout;

    function resetTimer() {
        clearTimeout(timeout);
        timeout = setTimeout(logout, inactivityTime);
    }

  function logout() {
    const locale = document.documentElement.lang || 'fr'; // Récupère la langue de la page
    window.location.href = `/${locale}/login`;
}

    window.onload = resetTimer;
    document.onmousemove = resetTimer;
    document.onkeypress = resetTimer;
    document.onclick = resetTimer;
    document.onscroll = resetTimer;
</script>
<script>
  const descriptionInput = document.getElementById('description');
  const charCount = document.getElementById('charCount');

  descriptionInput.addEventListener('input', function() {
    charCount.textContent = `${descriptionInput.value.length}/820 caractères`;
  });
</script>
<script>
  document.getElementById('add-property-form').addEventListener('submit', function(event) {
      let missingFields = [];
      const requiredFields = ['price', 'surface', 'country', 'city', 'propertyType', 'description'];
      
      requiredFields.forEach(field => {
          const input = document.getElementById(field);
          if (!input.value.trim()) {
              missingFields.push(field);
              input.style.border = "2px solid red";  // Mets en rouge les champs vides
          } else {
              input.style.border = "";  // Remets la bordure normale si rempli
          }
      });

      if (missingFields.length > 0) {
          event.preventDefault(); // Empêche l'envoi du formulaire
          alert("Veuillez remplir tous les champs obligatoires avant de soumettre le formulaire.");
      }
  });
</script>
<script>
document.addEventListener("DOMContentLoaded", function () {
    function handleFileUpload(input, progressId, statusId) {
        const file = input.files[0];

        if (file) {
            const progressBar = document.getElementById(progressId);
            const status = document.getElementById(statusId);

            // Réinitialisation
            progressBar.value = 0;
            progressBar.classList.remove("hidden");
            status.classList.remove("hidden");
            status.textContent = "Chargement en cours...";

            // Simulation d'upload progressif (remplace ça par une vraie requête si besoin)
            let progress = 0;
            const interval = setInterval(() => {
                progress += 10;
                progressBar.value = progress;

                if (progress >= 100) {
                    clearInterval(interval);
                    status.textContent = "✅ Image chargée avec succès !";
                    setTimeout(() => {
                        progressBar.classList.add("hidden");
                        status.classList.add("hidden");
                    }, 2000); // Cache après 2 secondes
                }
            }, 200);
        }
    }

    // Événements sur les inputs file
    document.getElementById("photo1").addEventListener("change", function () {
        handleFileUpload(this, "progress1", "status1");
    });

    document.getElementById("photo2").addEventListener("change", function () {
        handleFileUpload(this, "progress2", "status2");
    });
});
</script>
<script>
function formatDate(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0'); // Jour à 2 chiffres
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Mois à 2 chiffres
    const year = date.getFullYear(); // Année complète

    return `${day}-${month}-${year}`;
}

async function loadOrders() {
    try {
        const response = await fetch('/user/orders');
        if (!response.ok) {
            throw new Error('Erreur lors du chargement des commandes.');
        }

        const orders = await response.json();
        const ordersList = document.getElementById('orders-list');
        ordersList.innerHTML = '';

        const noOrdersMessage = document.getElementById('no-orders-message');
        if (orders.length === 0) {
            noOrdersMessage.style.display = 'block';
        } else {
            noOrdersMessage.style.display = 'none';

            orders.forEach(order => {
                const orderDate = new Date(order.createdAt); // Date de création de la commande
                const expiryDate = new Date(order.expiryDateFormatted); // Date d'expiration
                const today = new Date(); // Date actuelle
                const timeDiff = expiryDate - today;
                const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)); // Convertir en jours

                // Éviter un affichage de jours restants négatif
                const adjustedDaysRemaining = daysRemaining >= 0 ? daysRemaining : 0;
                const progress = Math.min(((90 - adjustedDaysRemaining) / 90) * 100, 100);

                // Déterminer la couleur de la barre de progression
                let progressBarColor = '#8BC34A'; // 🟢 Vert (par défaut)
                if (adjustedDaysRemaining <= 30) progressBarColor = '#FFC107'; // 🟠 Orange
                if (adjustedDaysRemaining <= 15) progressBarColor = '#FF5722'; // 🔴 Rouge

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${order.orderId}</td>
                    <td>${orderDate.toLocaleDateString('fr-FR')}</td>
                    <td>${order.status === 'paid' ? '<span class="badge bg-success">Payé</span>' : '<span class="badge bg-warning">En attente</span>'}</td>
                    <td>
                        ${adjustedDaysRemaining} jours restants
                        <div class="progress" style="height: 10px; margin-top: 5px;">
                            <div class="progress-bar" role="progressbar" 
                                style="width: ${progress}%; background-color: ${progressBarColor};">
                            </div>
                        </div>
                    </td>
                    <td>${expiryDate.toLocaleDateString('fr-FR')}</td>
                    <td>
                        <button class="btn btn-outline-dark btn-sm" onclick="copyURL('/landing-pages/67d34cbd22d48feecc15c35f.html')">Copier</button>
                        <button class="btn btn-dark btn-sm" onclick="window.open('${order.propertyId.url}', '_blank')">Voir</button>
                    </td>
                `;
                ordersList.appendChild(row);
            });
        }
    } catch (error) {
        document.getElementById('orders-list').innerHTML = '<tr><td colspan="10" class="text-center">Erreur lors du chargement des commandes.</td></tr>';
    }
}

// Charger la liste des commandes au chargement de la page
document.addEventListener('DOMContentLoaded', loadOrders);


// Charger les commandes quand on affiche la section "orders"
function showSection(sectionId) {
  const sections = ['account', 'landing', 'donnees', 'created-pages', 'orders'];
  sections.forEach(id => {
    document.getElementById(id).style.display = id === sectionId ? 'block' : 'none';
  });

  if (sectionId === 'orders') {
    loadOrders();
  }
}
// Fonction pour copier l'URL de la propriété
function copyURL(url) {
  const fullUrl = `https://uap.immo${url}`;
  navigator.clipboard.writeText(fullUrl).then(() => {
    alert("URL copiée !");
  }).catch(err => console.error('Impossible de copier l\'URL : ', err));
}
</script>
<script>
    async function loadLandingPages() {
        try {
            const response = await fetch('/user/landing-pages');
            if (!response.ok) throw new Error("Erreur lors du chargement des données");

            const landingPages = await response.json();
            const landingPagesList = document.getElementById('properties-list');
            landingPagesList.innerHTML = '';

            const noPropertiesMessage = document.getElementById('no-properties-message');
            if (landingPages.length === 0) {
                noPropertiesMessage.style.display = 'block';
            } else {
                noPropertiesMessage.style.display = 'none';
                landingPages.forEach(page => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${page.rooms}</td>
                        <td>${page.surface} m²</td>
                        <td>${page.price.toLocaleString('fr-FR')} €</td>
                        <td>${page.city}</td>
                        <td>${page.country}</td>
                        <td><a href="${page.url}" target="_blank">${page.url}</a></td>
                        <td>
                            <button class="btn btn-outline-dark btn-sm" onclick="copyURL('${page.url}')">Copier</button>
                            <button class="btn btn-primary btn-sm" onclick="redirectToPayment('${page._id}')">Diffuser</button>
                        </td>
                    `;
                    landingPagesList.appendChild(row);
                });
            }
        } catch (error) {
            console.error("Erreur lors du chargement des landing pages :", error);
            document.getElementById('properties-list').innerHTML = '<tr><td colspan="7" class="text-center">Erreur lors du chargement des landing pages.</td></tr>';
        }
    }

    function copyURL(url) {
        const fullUrl = `https://uap.immo${url}`;
        navigator.clipboard.writeText(fullUrl)
            .then(() => {
                alert("URL copiée !");
            })
            .catch(err => console.error('Impossible de copier l\'URL : ', err));
    }

    function redirectToPayment(propertyId) {
        const locale = document.documentElement.lang || 'fr';
        window.location.href = `/${locale}/payment?propertyId=${encodeURIComponent(propertyId)}`;
    }

    document.addEventListener("DOMContentLoaded", function () {
        loadLandingPages();
    });
</script>
<script>
async function renewOrder(orderId) { 
  try { 
    const response = await fetch('/user/orders/renew', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ orderId }) 
    });

    const result = await response.json();
    if (response.ok) { 
      alert('Commande renouvelée avec succès !'); 
      loadOrders(); // Recharger la liste des commandes 
    } else { 
      alert(result.error || 'Erreur lors du renouvellement de la commande.'); 
    }
  } catch (error) { 
    console.error('Erreur lors du renouvellement :', error); 
    alert('Une erreur est survenue.'); 
  }
}
</script>
<script>
async function loadStats() {
    try {
        const response = await fetch('/user/landing-pages'); // Récupère les pages générées
        const pages = await response.json();
        const statsList = document.getElementById('stats-list');
        statsList.innerHTML = '';

        for (const page of pages) {
            const pageId = page.url.split('/').pop().replace('.html', '');
            const res = await fetch(`/api/stats/${pageId}`);
            const data = await res.json();

            data.forEach(stat => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><a href="${page.url}" target="_blank">${page.url}</a></td>
                    <td>${stat.views || 0}</td>
                    <td>${stat.users || 0}</td>
                    <td>${stat.sessionSource || "N/A"}</td>
                    <td>${stat.sessionMedium || "N/A"}</td>
                    <td>${stat.country || "N/A"}</td>
                    <td>${stat.city || "N/A"}</td>
                    <td>${stat.deviceCategory || "N/A"}</td>
                `;
                statsList.appendChild(row);
            });
        }
    } catch (error) {
        console.error('Erreur lors du chargement des statistiques:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadStats();
});
</script>


</body>
</html>
