//pedir una materia prima a un proveedor
// Paneles SPA
const panels = ["panelAgregar","panelCrear","panelVer"];
function mostrarPanel(id){
  panels.forEach(p => document.getElementById(p).style.display = "none");
  document.getElementById(id).style.display = "block";
}
document.querySelectorAll(".btn-nav").forEach(btn=>{
  btn.addEventListener("click",()=>mostrarPanel(btn.dataset.panel));
});
mostrarPanel("panelAgregar");

// Lista temporal de materias
let listaTemporal = {};
const listaEl = document.getElementById("listaTemporal");
function renderLista(){
  listaEl.innerHTML = Object.entries(listaTemporal)
    .map(([n,v])=>`<li>${n}: ${v.cantidad} ${v.unidad}</li>`)
    .join("") || "<li><em>Vacío</em></li>";
}
document.getElementById("btnAgregarMP").addEventListener("click",()=>{
  const nombre=document.getElementById("mpNombre").value.trim();
  const cantidad=parseFloat(document.getElementById("mpCantidad").value);
  const unidad=document.getElementById("mpUnidad").value;
  if(!nombre||isNaN(cantidad)||cantidad<=0){alert("Complete bien");return;}
  listaTemporal[nombre]={cantidad,unidad};
  document.getElementById("mpNombre").value="";
  document.getElementById("mpCantidad").value="";
  renderLista();
});
document.getElementById("limpiarLista").addEventListener("click",()=>{
  listaTemporal={};renderLista();
});
renderLista();

// Pedidos (localStorage)
let pedidos = JSON.parse(localStorage.getItem("pedidos")) || [];
const pedidosBody=document.getElementById("pedidosBody");
function guardarPedidos(){localStorage.setItem("pedidos",JSON.stringify(pedidos))}
function renderPedidos(){
  pedidosBody.innerHTML = pedidos.map((p,i)=>`
    <tr>
      <td>${p.referencia}</td>
      <td>${p.proveedor}</td>
      <td>${Object.entries(p.requerimientos).map(([n,v])=>`${n}: ${v.cantidad} ${v.unidad}`).join("<br>")}</td>
      <td>${p.fechaEntrega||"--"}</td>
      <td>${p.prioridad}</td>
      <td>${p.movimientos.join(" → ")}</td>
      <td><button onclick="eliminarPedido(${i})">❌</button></td>
    </tr>`).join("") || "<tr><td colspan='7'>Sin pedidos</td></tr>";
}
function eliminarPedido(i){pedidos.splice(i,1);guardarPedidos();renderPedidos();}

// Formulario
document.getElementById("formPedido").addEventListener("submit",e=>{
  e.preventDefault();
  if(Object.keys(listaTemporal).length===0){alert("Agregue materias");return;}
  const pedido={
    proveedor:document.getElementById("proveedor").value.trim(),
    referencia:document.getElementById("refPedido").value.trim()||`P-${Date.now()}`,
    fechaEntrega:document.getElementById("fechaEntrega").value,
    prioridad:document.getElementById("prioridad").value,
    notas:document.getElementById("notas").value.trim(),
    requerimientos:{...listaTemporal},
    movimientos:["Creado"]
  };
  pedidos.push(pedido);
  guardarPedidos();renderPedidos();
  e.target.reset();listaTemporal={};renderLista();
  mostrarPanel("panelVer");
});
renderPedidos();
