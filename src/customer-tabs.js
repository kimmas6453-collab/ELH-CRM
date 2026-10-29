import './customer-tabs.css';

export function enhanceCustomerDetail(dialog) {
  if (!dialog || !dialog.isConnected) return;

  const form = dialog.querySelector('#update');
  const history = dialog.querySelector('.history');

  if (!form || !history) return;
  if (dialog.querySelector('.eh-customer-tabs')) return;

  const heading = [...dialog.querySelectorAll('h3')]
    .find(x => x.textContent.includes('Lịch sử'));

  const more = dialog.querySelector('#history-more');
  const source = dialog.querySelector('.source-details');

  const tabs = document.createElement('nav');
  tabs.className = 'eh-customer-tabs';
  tabs.setAttribute('aria-label', 'Thông tin khách hàng');

  tabs.innerHTML = `
    <button type="button"
      class="active" data-tab="current">
      Hiện tại
    </button>
    <button type="button" data-tab="history">
      Lịch sử tương tác
    </button>
  `;

  form.before(tabs);

  const currentArea = document.createElement('section');
  currentArea.className = 'eh-customer-current';

  const historyArea = document.createElement('section');
  historyArea.className = 'eh-customer-history';

  tabs.after(currentArea);
  currentArea.after(historyArea);

  currentArea.append(form);
  if (source) currentArea.append(source);

  if (heading) historyArea.append(heading);
  historyArea.append(history);
  if (more) historyArea.append(more);

  function switchTab(name) {
    const showHistory = name === 'history';

    currentArea.hidden = showHistory;
    historyArea.hidden = !showHistory;

    tabs.querySelectorAll('button').forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.tab === name
      );
    });
  }

  tabs.querySelectorAll('button').forEach(button => {
    button.onclick = () => switchTab(button.dataset.tab);
  });

  // Start in current customer tab.
  switchTab('current');
}