const statusForms = document.querySelectorAll('.status-form select');

statusForms.forEach((select) => {
  select.addEventListener('change', () => {
    select.closest('form')?.submit();
  });
});
