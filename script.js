let orders = [];
// this is the logic for packer
// DOM refs
const fileInput = document.getElementById('fileInput');
const orderList = document.getElementById('orderList');
const searchInput = document.getElementById('searchInput');

// Buttons
document.getElementById('darkModeBtn').onclick = () => {
  document.body.classList.toggle('dark-mode');
};

document.getElementById('exportBtn').onclick = exportData;
document.getElementById('clearBtn').onclick = clearAll;
document.getElementById('chat-icon').onclick = toggleChat;
searchInput.addEventListener('keyup', filter);

// File upload
fileInput.addEventListener('change', handleFile);

// =====================
// CORE LOGIC
// =====================

function handleFile(e) {
  const file = e.target.files[0];
  const reader = new FileReader();

  reader.onload = function (e) {
    const data = new Uint8Array(e.target.result);
    const wb = XLSX.read(data, { type: 'array' });
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });

    const map = new Map();

    raw.forEach(row => {
      const id = row.Name;

      if (!map.has(id)) {
        map.set(id, {
          id,
          customer: row['Billing Name'] || "N/A",
          items: []
        });
      }

      const order = map.get(id);

      order.items.push({
        name: row['Lineitem name'],
        qty: Number(row['Lineitem quantity']),
        packedQty: 0,
        vendor: row['Vendor'] || "Unknown",

        rowRef: row
      });
    });

    orders = Array.from(map.values());
    render();
  };

  reader.readAsArrayBuffer(file);
}

function render() {
  orderList.innerHTML = '';

  orders.forEach((order, oIdx) => {
   const packedCount = order.items.filter(i => i.packedQty === i.qty).length;

const hasAnyPacked = order.items.some(i => i.packedQty > 0);



  const isComplete = packedCount === order.items.length;
  const isPartial = packedCount > 0 && packedCount < order.items.length;

  const card = document.createElement('div');

  card.className = `order-card ${
    isComplete ? 'complete' : isPartial ? 'partial' : ''
  }`;

  card.innerHTML = `
    <div><b>Order ${order.id}</b></div>
    <div>${order.customer}</div>
    <div>Checked: ${packedCount}/${order.items.length}</div>
  `;

    order.items.forEach((item, iIdx) => {
      const row = document.createElement('div');
      row.className = 'item-row';

      row.innerHTML = `
        <span class="item-name">${item.name}</span>
        <span class="vendor">${item.vendor}</span>

        <input 
          type="number" 
          min="0" 
          max="${item.qty}" 
          value="${item.packedQty}" 
          class="qty-input"
        >

        <b>x${item.qty}</b>
    `;

     const input = row.querySelector('input');

      input.addEventListener('input', (e) => {
      let val = Number(e.target.value);

      if (val > item.qty) val = item.qty;
      if (val < 0) val = 0;

      orders[oIdx].items[iIdx].packedQty = val;

      render();
    });

      card.appendChild(row);
    });

    orderList.appendChild(card);
  });
}


function exportData() {
  if (!orders.length) return alert("No data");

  const final = [];

  orders.forEach(o => {
    o.items.forEach(i => {
      final.push({
        Order: o.id,
        Customer: o.customer,
        Item: i.name,
        Vendor: i.vendor,
        Ordered: i.qty,
        Packed: i.packedQty,
        Missing: i.qty - i.packedQty
      });
    });
  });

  const ws = XLSX.utils.json_to_sheet(final);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");

  XLSX.writeFile(wb, `Packing_Report.xlsx`);
}

function clearAll() {
  if (confirm("Clear all orders?")) {
    orders = [];
    render();
  }
}

function filter() {
  const q = searchInput.value.toLowerCase();

  document.querySelectorAll('.order-card').forEach(c => {
    c.style.display = c.innerText.toLowerCase().includes(q) ? 'block' : 'none';
  });
}

function toggleChat() {
  const f = document.getElementById('chat-frame');
  f.style.display = f.style.display === 'block' ? 'none' : 'block';
}

// this vendor ordering logic
function getProcurementData() {
  const result = {};

  orders.forEach(order => {
    order.items.forEach(item => {
      const vendor = item.vendor;
      const name = item.name;
      const qty = item.qty;

      if (!result[vendor]) {
        result[vendor] = {};
      }

      if (!result[vendor][name]) {
        result[vendor][name] = 0;
      }

      result[vendor][name] += qty;
    });
  });

  return result;
}

// Render procurement view


function renderProcurement() {
  const data = getProcurementData();

  orderList.innerHTML = '';

  Object.keys(data).forEach(vendor => {
    const card = document.createElement('div');
    card.className = 'order-card';

    let itemsHtml = `<div><b>${vendor}</b></div>`;

    Object.keys(data[vendor]).forEach(item => {
      itemsHtml += `
        <div class="item-row">
          <span>${item}</span>
          <b>x${data[vendor][item]}</b>
        </div>
      `;
    });

    card.innerHTML = itemsHtml;
    orderList.appendChild(card);
  });
}

document.getElementById('procurementBtn').onclick = renderProcurement;

function exportProcurement() {
  const data = getProcurementData();
  const final = [];

  Object.keys(data).forEach(vendor => {
    Object.keys(data[vendor]).forEach(item => {
      final.push({
        Vendor: vendor,
        Item: item,
        Total_Quantity: data[vendor][item]
      });
    });
  });

  const ws = XLSX.utils.json_to_sheet(final);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Procurement");

  XLSX.writeFile(wb, `Procurement_Report.xlsx`);
}

document.getElementById('packingViewBtn').onclick = render;
document.getElementById('exportProcurementBtn').onclick = exportProcurement;