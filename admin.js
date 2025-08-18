import { db, ref, onValue, push, update, remove } from './firebase-config.js';

const listaAdmin = document.getElementById('lista-admin');
let produtosCache = {};
let isSaving = false;

function esc(v) {
  if (v === undefined || v === null) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CLOUDINARY_CLOUD_NAME = 'dvayoga24';
const CLOUDINARY_UPLOAD_PRESET = 'acai-da-bella';
const CLOUDINARY_FOLDER = 'produtos';
const MAX_FILE_SIZE_MB = 5;

async function uploadImagem(file, nome) {
  if (!file) return null;
  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > MAX_FILE_SIZE_MB) throw new Error(`Imagem ${nome} muito grande.`);
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', CLOUDINARY_FOLDER);
  if (nome) formData.append('context', 'alt=' + esc(nome));
  const res = await fetch(url, { method: 'POST', body: formData });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error('Erro Cloudinary: ' + JSON.stringify(data.error));
  return { url: data.secure_url, publicId: data.public_id };
}

// ---------- FORMULÁRIO NOVO PRODUTO ----------
const formNovo = document.createElement('div');
formNovo.className = 'novo-produto';
formNovo.innerHTML = `
  <h2>➕ Adicionar Novo Produto</h2>
  <label>Nome:<input type="text" id="novo-nome" placeholder="Ex: Açaí Mega"></label>
  <label>Preço:<input type="number" id="novo-preco" step="0.01" placeholder="Ex: 19.90"></label>
  <label>Imagem:<input type="file" id="novo-imagem" accept="image/*"></label>

  <h3>Complementos</h3>
  <div id="novo-complementos"></div>
  <button type="button" id="btn-add-comp">Adicionar Complemento</button>

  <h3>Acompanhamentos</h3>
  <div id="novo-acompanhamentos"></div>
  <button type="button" id="btn-add-acomp">Adicionar Acompanhamento</button>

  <br><br>
  <button id="btn-adicionar" type="button">Adicionar Produto</button>
  <hr>
`;
document.body.insertBefore(formNovo, listaAdmin);

function criarCampoExtraDOM(containerIdOrEl, nome = '', preco = '', imagemUrl = '') {
  const container = typeof containerIdOrEl === 'string' ? document.getElementById(containerIdOrEl) : containerIdOrEl;
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'extra-item';
  div.style.marginBottom = '6px';
  div.innerHTML = `
    <input type="text" placeholder="Nome" class="extra-nome" value="${esc(nome)}" style="margin-right:6px">
    <input type="number" placeholder="Preço" step="0.01" class="extra-preco" value="${esc(preco)}" style="width:90px;margin-right:6px">
    <input type="file" class="extra-imagem" accept="image/*" style="margin-right:6px">
    ${imagemUrl ? `<img src="${imagemUrl}" style="width:40px;height:auto;margin-right:6px">` : ''}
    <button type="button" class="extra-remove" style="margin-left:8px">Remover</button>
  `;
  container.appendChild(div);
  div.querySelector('.extra-remove').addEventListener('click', () => div.remove());
}

document.getElementById('btn-add-comp').addEventListener('click', () =>
  criarCampoExtraDOM('novo-complementos')
);
document.getElementById('btn-add-acomp').addEventListener('click', () =>
  criarCampoExtraDOM('novo-acompanhamentos')
);

// ---------- ADICIONAR PRODUTO ----------
document.getElementById('btn-adicionar').addEventListener('click', async () => {
  if (isSaving) return;
  isSaving = true;
  const btn = document.getElementById('btn-adicionar');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  try {
    const nome = document.getElementById('novo-nome').value.trim();
    const preco = parseFloat(document.getElementById('novo-preco').value);
    const fileInput = document.getElementById('novo-imagem');
    const file = fileInput.files[0];
    if (!nome || isNaN(preco)) throw new Error('Preencha nome e preço corretamente');
    if (!file) throw new Error('Escolha uma imagem');

    const up = await uploadImagem(file, nome);

    const complementos = Array.from(document.querySelectorAll('#novo-complementos .extra-item')).map(async div => {
      const cNome = div.querySelector('.extra-nome').value.trim();
      const cPreco = parseFloat(div.querySelector('.extra-preco').value) || 0;
      const cFile = div.querySelector('.extra-imagem').files[0];
      let cImagem = '';
      if (cFile) {
        const upComp = await uploadImagem(cFile, cNome);
        cImagem = upComp.url;
      }
      return { nome: cNome, preco: cPreco, imagem: cImagem };
    });

    const acompanhamentos = Array.from(document.querySelectorAll('#novo-acompanhamentos .extra-item')).map(div => ({
      nome: div.querySelector('.extra-nome').value.trim(),
      preco: parseFloat(div.querySelector('.extra-preco').value) || 0
    }));

    const complementosFinal = await Promise.all(complementos);

    await push(ref(db, 'produtos'), {
      nome,
      preco,
      complementos: complementosFinal,
      acompanhamentos,
      imagem: up.url,
      cloudinaryPublicId: up.publicId
    });

    document.getElementById('novo-nome').value = '';
    document.getElementById('novo-preco').value = '';
    fileInput.value = '';
    document.getElementById('novo-complementos').innerHTML = '';
    document.getElementById('novo-acompanhamentos').innerHTML = '';
    alert('Produto adicionado com sucesso!');
  } catch (e) {
    alert('Erro: ' + e.message);
    console.error(e);
  } finally {
    isSaving = false;
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

// ---------- RENDER / EDIT ----------
function criarOuAtualizarElementoProduto(key, p) {
  let item = document.getElementById('produto-item-' + key);
  if (!item) {
    item = document.createElement('div');
    item.id = 'produto-item-' + key;
    item.className = 'produto-edicao';
    listaAdmin.appendChild(item);
  }

  item.style.border = '1px solid #ddd';
  item.style.padding = '8px';
  item.style.marginBottom = '8px';

  item.innerHTML = `
    <label>Nome:<input type="text" id="nome-${key}" value="${esc(p.nome)}"></label><br>
    <label>Preço:<input type="number" id="preco-${key}" value="${esc(p.preco)}" step="0.01" style="width:110px"></label><br>
    <label>Imagem:<input type="file" id="imagem-${key}" accept="image/*"></label>
    <div>${p.imagem ? `<img src="${p.imagem}" style="width:80px;height:auto;margin-top:6px">` : ''}</div>
    <h4>Complementos</h4><div id="comp-${key}"></div>
    <button type="button" class="add-comp-por-prod" data-key="${key}">Adicionar Complemento</button>
    <h4>Acompanhamentos</h4><div id="acomp-${key}"></div>
    <button type="button" class="add-acomp-por-prod" data-key="${key}">Adicionar Acompanhamento</button>
    <div style="margin-top:8px">
      <button data-key="${key}" class="salvar">💾 Salvar</button>
      <button data-key="${key}" class="remover">🗑️ Remover</button>
    </div>
  `;

  const compContainer = item.querySelector('#comp-' + key);
  const acompContainer = item.querySelector('#acomp-' + key);
  compContainer.innerHTML = '';
  acompContainer.innerHTML = '';

  (Array.isArray(p.complementos) ? p.complementos : []).forEach(c =>
    criarCampoExtraDOM(compContainer, c.nome, c.preco, c.imagem)
  );
  (Array.isArray(p.acompanhamentos) ? p.acompanhamentos : []).forEach(a =>
    criarCampoExtraDOM(acompContainer, a.nome, a.preco)
  );

  item.querySelector('.add-comp-por-prod').addEventListener('click', () =>
    criarCampoExtraDOM('comp-' + key)
  );
  item.querySelector('.add-acomp-por-prod').addEventListener('click', () =>
    criarCampoExtraDOM('acomp-' + key)
  );

  item.querySelector('.remover').addEventListener('click', () => {
    if (confirm('Remover o produto "' + p.nome + '"?')) remove(ref(db, 'produtos/' + key));
  });

  item.querySelector('.salvar').addEventListener('click', async () => {
    if (isSaving) return;
    isSaving = true;
    const btn = item.querySelector('.salvar');
    const prev = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
      const nome = document.getElementById('nome-' + key).value.trim();
      const preco = parseFloat(document.getElementById('preco-' + key).value);

      const complementos = await Promise.all(Array.from(compContainer.querySelectorAll('.extra-item')).map(async div => {
        const cNome = div.querySelector('.extra-nome').value.trim();
        const cPreco = parseFloat(div.querySelector('.extra-preco').value) || 0;
        const cFile = div.querySelector('.extra-imagem').files[0];
        let cImagem = div.querySelector('img')?.src || '';
        if (cFile) {
          const upComp = await uploadImagem(cFile, cNome);
          cImagem = upComp.url;
        }
        return { nome: cNome, preco: cPreco, imagem: cImagem };
      }));

      const acompanhamentos = Array.from(acompContainer.querySelectorAll('.extra-item')).map(div => ({
        nome: div.querySelector('.extra-nome').value.trim(),
        preco: parseFloat(div.querySelector('.extra-preco').value) || 0
      }));

      const fileInput = item.querySelector('#imagem-' + key);
      let imageUrl = p.imagem || null;
      let publicId = p.cloudinaryPublicId || null;
      if (fileInput.files[0]) {
        const up = await uploadImagem(fileInput.files[0], nome);
        imageUrl = up.url;
        publicId = up.publicId;
      }

      await update(ref(db, 'produtos/' + key), {
        nome,
        preco,
        complementos,
        acompanhamentos,
        imagem: imageUrl,
        cloudinaryPublicId: publicId
      });

      alert('Produto salvo com sucesso!');
    } catch (e) {
      alert('Erro: ' + (e.message || e));
      console.error(e);
    } finally {
      isSaving = false;
      btn.disabled = false;
      btn.textContent = prev;
    }
  });
}

onValue(ref(db, 'produtos'), snap => {
  const novosDados = snap.val() || {};
  const chavesNovas = new Set(Object.keys(novosDados));
  const chavesAntigas = new Set(Object.keys(produtosCache));

  for (const key of chavesNovas) {
    if (!chavesAntigas.has(key) || JSON.stringify(novosDados[key]) !== JSON.stringify(produtosCache[key])) {
      criarOuAtualizarElementoProduto(key, novosDados[key]);
    }
  }

  for (const key of chavesAntigas) {
    if (!chavesNovas.has(key)) {
      const itemParaRemover = document.getElementById('produto-item-' + key);
      if (itemParaRemover) itemParaRemover.remove();
    }
  }

  produtosCache = novosDados;

  if (Object.keys(produtosCache).length === 0 && listaAdmin) {
    listaAdmin.innerHTML = '<p style="text-align:center">Nenhum produto cadastrado.</p>';
  }
});
