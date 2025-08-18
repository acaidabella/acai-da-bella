import { db, ref, onValue } from './firebase-config.js';

// ---------- Referências HTML ----------
const listaProdutos = document.getElementById('listaProdutos');
const modal = document.getElementById('modalMontagem');
const fecharModal = document.getElementById('fecharModal');
const form = document.getElementById('formMontagem');
const nomeProdutoBase = document.getElementById('nomeProdutoBase');
const precoBase = document.getElementById('precoBase');
const tituloModal = document.getElementById('tituloProdutoModal');
const containerComplementos = document.getElementById('containerComplementos');

const carrinho = document.getElementById('carrinho');
const listaPedidos = document.getElementById('lista-pedidos');
const totalElemento = document.getElementById('total');
let total = 0;

// ---------- Renderização dos produtos ----------
function renderizarProdutos(produtos) {
  listaProdutos.innerHTML = '';
  if (!produtos) return;

  Object.entries(produtos).forEach(([id, p]) => {
    const card = document.createElement('div');
    card.className = 'produto';
    card.dataset.id = id;

    card.innerHTML = `
      <img src="${p.imagem}" alt="${p.nome}">
      <h2>${p.nome}</h2>
      <p>Escolha os complementos</p>
      <span>R$ ${parseFloat(p.preco).toFixed(2).replace('.', ',')}</span><br>
      <button class="btn-customizar">Adicionar</button>
    `;

    card.querySelector('.btn-customizar').addEventListener('click', () => abrirModalProduto(id, p));

    listaProdutos.appendChild(card);
  });

  aplicarFiltros();
}

// ---------- Função abrir modal ----------
function abrirModalProduto(id, produto) {
  nomeProdutoBase.value = produto.nome;
  precoBase.value = produto.preco;
  tituloModal.textContent = produto.nome;
  containerComplementos.innerHTML = 'Carregando complementos...';

  const complementoRef = ref(db, `produtos/${id}/complementos`);
  onValue(complementoRef, snapshot => {
    const complementos = snapshot.val() ? Object.values(snapshot.val()) : [];
    containerComplementos.innerHTML = '';

    if (complementos.length === 0) {
      containerComplementos.innerHTML = '<p>Sem complementos para este produto.</p>';
      return;
    }

    complementos.forEach(comp => {
      const divCampo = document.createElement('div');
      divCampo.classList.add('campo');
      divCampo.style.display = 'flex';
      divCampo.style.alignItems = 'center';
      divCampo.style.marginBottom = '4px';

      if (comp.imagem) {
        const img = document.createElement('img');
        img.src = comp.imagem;
        img.alt = comp.nome;
        img.style.width = '30px';
        img.style.height = '30px';
        img.style.marginRight = '6px';
        divCampo.appendChild(img);
      }

      const label = document.createElement('label');
      label.htmlFor = `comp_${comp.nome.replace(/\s+/g, '_')}`;
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `comp_${comp.nome.replace(/\s+/g, '_')}`;
      checkbox.name = 'complementos';
      checkbox.value = comp.nome;
      checkbox.dataset.preco = comp.preco;
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(` ${comp.nome} (+R$${parseFloat(comp.preco).toFixed(2).replace('.', ',')})`));

      divCampo.appendChild(label);
      containerComplementos.appendChild(divCampo);
    });
  }, { onlyOnce: true });

  modal.style.display = 'flex';
}

// ---------- Fechar modal ----------
fecharModal.addEventListener('click', () => {
  modal.style.display = 'none';
  form.reset();
});
window.addEventListener('click', e => { if (e.target === modal) { modal.style.display = 'none'; form.reset(); } });

// ---------- Carrinho ----------
form.addEventListener('submit', e => {
  e.preventDefault();
  const nome = nomeProdutoBase.value;
  const basePreco = parseFloat(precoBase.value);
  let adicionais = 0;
  let complementosSelecionados = [];

  form.querySelectorAll('#containerComplementos input[type="checkbox"]:checked').forEach(cb => {
    complementosSelecionados.push(cb.value);
    adicionais += parseFloat(cb.dataset.preco) || 0;
  });

  const precoFinal = basePreco + adicionais;
  const imagemProduto = document.querySelector(`.produto[data-id="${nomeProdutoBase.value}"] img`)?.src || '';

  const item = { nome, preco: precoFinal, complementos: complementosSelecionados, imagem: imagemProduto };
  adicionarAoCarrinho(item);
  form.reset();
  modal.style.display = 'none';
});

// ---------- Adicionar item ao carrinho ----------
function adicionarAoCarrinho(item) {
  carrinho.style.display = 'block';
  const li = document.createElement('li');
  li.style.display = 'flex';
  li.style.alignItems = 'center';
  li.style.marginBottom = '6px';

  if (item.imagem) {
    const img = document.createElement('img');
    img.src = item.imagem;
    img.alt = item.nome;
    img.style.width = '40px';
    img.style.height = '40px';
    img.style.marginRight = '6px';
    li.appendChild(img);
  }

  const span = document.createElement('span');
  span.textContent = `${item.nome} - Complementos: ${item.complementos.join(', ') || 'Nenhum'} - R$ ${item.preco.toFixed(2).replace('.', ',')}`;
  span.style.flex = '1';
  li.appendChild(span);

  const btnRemover = document.createElement('button');
  btnRemover.textContent = '❌';
  btnRemover.style.marginLeft = '6px';
  btnRemover.addEventListener('click', () => {
    total -= item.preco;
    totalElemento.textContent = `Total: R$ ${total.toFixed(2).replace('.', ',')}`;
    li.remove();
    if (listaPedidos.children.length === 0) carrinho.style.display = 'none';
  });
  li.appendChild(btnRemover);

  listaPedidos.appendChild(li);
  total += item.preco;
  totalElemento.textContent = `Total: R$ ${total.toFixed(2).replace('.', ',')}`;
}

// ---------- Modal final ----------
const confirmarPedido = document.getElementById('confirmarPedido');
const formularioFinal = document.getElementById('formularioFinal');
const fecharFinal = document.getElementById('fecharFinal');
const resumoTotal = document.getElementById('resumoTotal');

confirmarPedido.addEventListener('click', () => {
  if (listaPedidos.children.length === 0) {
    alert("Seu carrinho está vazio.");
    return;
  }
  resumoTotal.textContent = `Total: R$ ${total.toFixed(2).replace('.', ',')}`;
  formularioFinal.style.display = 'flex';
});

fecharFinal.addEventListener('click', () => {
  formularioFinal.style.display = 'none';
});

// ---------- Envio para Google Forms ----------
document.getElementById('formFinal').addEventListener('submit', e => {
  e.preventDefault();
  const nomeCliente = document.getElementById('nomeCliente').value;
  const enderecoCliente = document.getElementById('enderecoCliente').value;
  const metodoPagamento = document.getElementById('metodoPagamento').value;
  const metodoEntrega = document.getElementById('metodoEntrega').value;
  const telefoneCliente = document.getElementById('telefoneCliente').value;

  const itens = [];
  listaPedidos.querySelectorAll('li').forEach(li => itens.push(li.textContent));
  const totalFinal = total.toFixed(2).replace('.', ',');

  const formURL = `https://docs.google.com/forms/d/e/1FAIpQLSf2_KLWOlSiImG3wOErg7PAgdeYtEQNrubB8MRfjoF7h-mSZw/formResponse?` +
    `entry.647349166=${encodeURIComponent(nomeCliente)}&` +
    `entry.543244124=${encodeURIComponent(enderecoCliente)}&` +
    `entry.1199359519=${encodeURIComponent(itens.join('\n') + '\nTotal: R$ ' + totalFinal)}&` +
    `entry.579543688=${encodeURIComponent(metodoPagamento)}&` +
    `entry.393114016=${encodeURIComponent(metodoEntrega)}&` +
    `entry.1972266836=${encodeURIComponent(telefoneCliente)}`;

  fetch(formURL, { method: "POST", mode: "no-cors" })
    .then(() => {
      alert("✅ Pedido enviado com sucesso! 🍧");
      formularioFinal.style.display = 'none';
      listaPedidos.innerHTML = '';
      total = 0;
      totalElemento.textContent = 'Total: R$ 0,00';
      carrinho.style.display = 'none';
    })
    .catch(() => alert("❌ Erro ao enviar o pedido. Tente novamente."));
});

// ---------- Busca ----------
const campoBusca = document.getElementById('campoBusca');
const avisoBusca = document.createElement('p');
avisoBusca.id = "avisoBusca";
avisoBusca.style.textAlign = "center";
avisoBusca.style.color = "#800080";
avisoBusca.style.fontWeight = "bold";
avisoBusca.style.marginTop = "1rem";
document.querySelector('.produtos').appendChild(avisoBusca);

campoBusca.addEventListener('input', () => {
  const termo = campoBusca.value.trim().toLowerCase();
  let achou = false;
  document.querySelectorAll('.produto').forEach(card => {
    const nome = card.querySelector('h2').textContent.toLowerCase();
    if (nome.includes(termo)) { card.style.display = 'block'; achou = true; }
    else card.style.display = 'none';
  });
  avisoBusca.textContent = (!achou && termo !== '') ? `❌ Nenhuma opção com "${termo}" no nome.` : '';
});

// ---------- Filtros ----------
const categorias = {
  'barca': ['barca'],
  'fondue': ['fondue'],
  'picolé': ['picolé', 'picoles'],
  'monte seu copo': ['monte seu copo', 'monte seu açaí'],
  'todos': []
};
function aplicarFiltros() {
  document.querySelectorAll('.btn-categoria').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.categoria;
      const termos = categorias[cat];
      let achou = false;
      document.querySelectorAll('.produto').forEach(card => {
        const nome = card.querySelector('h2').textContent.toLowerCase();
        if (cat === 'todos' || termos.some(t => nome.includes(t))) { card.style.display = 'block'; achou = true; }
        else card.style.display = 'none';
      });
      document.querySelectorAll('.btn-categoria').forEach(b => b.classList.remove('ativa'));
      btn.classList.add('ativa');
      campoBusca.value = '';
      avisoBusca.textContent = achou ? '' : `❌ Nenhum produto encontrado na categoria "${cat}"`;
    });
  });
}
aplicarFiltros();

// ---------- Inicializa ----------
onValue(ref(db, 'produtos'), snap => renderizarProdutos(snap.val()));
