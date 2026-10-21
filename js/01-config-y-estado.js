
    const SUPABASE_URL = "https://itpkfuprqihmclsqjfki.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_sW8WBd-hoa155VOla5xj8A__0X494yO";
    const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const EMAIL_ADMIN = "enzitohkallepremium@gmail.com";
    const WHATSAPP_SOPORTE_PLANES = "542262541305";

    // NUEVA ESTRUCTURA JERÁRQUICA DE CATEGORÍAS PRINCIPALES Y SUBCATEGORÍAS
    const CATEGORIAS_JERARQUICAS = {
      "Gastronomía 🍔": [
        "Heladerías", "Pizzerías", "Empanadas", "Hamburguesas", 
        "Rotisería", "Panaderías & Pastelería", "Cafetería", 
        "Sushi & Comida Oriental", "Postres & Dulces", "Cervecería & Bebidas"
      ],
      "Moda & Indumentaria 👗": [
        "Moda Mujer", "Moda Hombre", "Ropa de Niños", "Calzado", "Deportes"
      ],
      "Hogar & Estilo 🏠": [
        "Bazar & Hogar", "Regalería & Regalos", "Librería & Juguetería", 
        "Cosmética & Belleza", "Mascotas"
      ],
      "Servicios & Tecnología ⚡": [
        "Tecnología & Celulares", "Mercados & Almacén", "Kiosco"
      ]
    };

    const CATEGORIAS_INDUMENTARIA = [
      "Ropa de Niños", "Moda Hombre", "Moda Mujer", "Calzado", "Deportes", "Bazar & Hogar", "Regalería & Regalos", "Librería & Juguetería", "Cosmética & Belleza", "Tecnología & Celulares"
    ];

    const DIAS_SEMANA = [
      { id: 'lun', nombre: 'Lunes' },
      { id: 'mar', nombre: 'Martes' },
      { id: 'mie', nombre: 'Miércoles' },
      { id: 'jue', nombre: 'Jueves' },
      { id: 'vie', nombre: 'Viernes' },
      { id: 'sab', nombre: 'Sábado' },
      { id: 'dom', nombre: 'Domingo' }
    ];

    let comerciosGlobales = [];
    let categoriaPrincipalSeleccionada = 'Todas';
    let subcategoriaSeleccionada = 'Todas';
    let comercioActivo = null;
    let comercioCarrito = null;
    let carrito = [];
    let usuarioActual = null;
    let modoEstrictoEnlace = false;
    let comercioBloqueadoId = null;
    let filtroAbierto = false, filtroEnvio = false, ordenPopulares = false;
    let limiteComercios = 12, ultimaListaComercios = [];
    let carritoListo = false, _tGuardarCarrito = null;
    let maxComerciosUsuario = 1;
    let perfilCargadoParaId = null;
    let perfilUsuarioPromise = Promise.resolve();

    let productoPendienteSabores = null;
    let cantidadSeleccionadaModalSabores = 1;
    let estadoSaboresPorUnidad = {};

    let promoItemsSeleccionados = {};
    let timeoutBusquedaGlobal = null;
