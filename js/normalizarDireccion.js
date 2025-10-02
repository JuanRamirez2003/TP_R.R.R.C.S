// Array global para guardar direcciones validadas
let direccionesValidas = [];

// Función que llama al servicio USIG
function normalizarDireccion() {
    const direccion = document.getElementById('direccion').value.trim();

    if (!validarFormatoDireccion(direccion)) {
        alert("El formato de la dirección debe ser: Calle número, Municipio \n NO SE OLVIDE DE PONER LA COMA");
        return;
    }
    // Si la dirección ya está en la lista de válidas, no hacer fetch
    if (direccionesValidas.includes(direccion)) {
        alert("La dirección ya es válida.");
        return;
    }

    const url = `https://servicios.usig.buenosaires.gob.ar/normalizar/?direccion=${encodeURIComponent(direccion)}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            mostrarResultados(data, 'direccion');
        })
        .catch(error => {
            console.error('Error:', error);
        });
}
function validarFormatoDireccion(direccion) {
    // Patrón básico: "Texto NÚMERO, Texto"
    const regex = /^.+\s\d+,\s.+$/;
    return regex.test(direccion);
}


function mostrarResultados(data, campo) {
    const resultadosDiv = document.getElementById(`resultados${campo.charAt(0).toUpperCase() + campo.slice(1)}`);
    resultadosDiv.innerHTML = '';
    direccionesValidas = []; // Limpiar direcciones previas

    if (data && data.direccionesNormalizadas && data.direccionesNormalizadas.length > 0) {
        const listaDirecciones = document.createElement('ul');
        listaDirecciones.style.listStyle = 'none';
        listaDirecciones.style.padding = '0';
        listaDirecciones.style.margin = '5px 0';
        listaDirecciones.style.border = '1px solid #fff';
        listaDirecciones.style.borderRadius = '6px';
        listaDirecciones.style.backgroundColor = '#444';
        listaDirecciones.style.maxHeight = '150px';
        listaDirecciones.style.overflowY = 'auto';
        data.direccionesNormalizadas.forEach(direccion => {
            const elementoLista = document.createElement('li');
            elementoLista.textContent = direccion.direccion;
            elementoLista.style.cursor = 'pointer';
            elementoLista.style.padding = '6px 10px';
            elementoLista.style.backgroundColor = '#444'; // Color inicial
            elementoLista.style.transition = 'background-color 0.2s'; // Suaviza el cambio de color

            // Cambiar color solo al pasar el mouse sobre este elemento
            elementoLista.addEventListener('mouseover', () => {
                elementoLista.style.backgroundColor = '#666';
            });
            elementoLista.addEventListener('mouseout', () => {
                elementoLista.style.backgroundColor = '#444';
            });

            elementoLista.addEventListener('click', () => {
                document.getElementById(campo).value = direccion.direccion;
                elementoLista.parentElement.style.display = 'none'; // Oculta la lista completa
            });

            listaDirecciones.appendChild(elementoLista);

            // Guardar dirección en array global
            direccionesValidas.push(direccion.direccion);
        });

        resultadosDiv.appendChild(listaDirecciones);
    } else {
        resultadosDiv.textContent = 'No se encontraron direcciones similares.';
        resultadosDiv.style.color = '#fff';
    }
}
// Validar que la dirección esté en la lista
function direccionEsValida(direccion) {
    return direccionesValidas.includes(direccion);
}

