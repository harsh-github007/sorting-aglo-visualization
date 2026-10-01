document.getElementById('lessonBtn').addEventListener('click', () => {
  const race = document.getElementById('raceToggle');
  if (race.checked) { race.checked = false; race.dispatchEvent(new Event('change')); }
  const algo = document.getElementById('algoA');
  const bubble = [...algo.options].find(option => /bubble/i.test(option.textContent));
  if (bubble) { algo.value = bubble.value; algo.dispatchEvent(new Event('change')); }
  const opponent = document.getElementById('algoB');
  const quick = [...opponent.options].find(option => /quicksort/i.test(option.textContent));
  if (quick) { opponent.value = quick.value; opponent.dispatchEvent(new Event('change')); }
  document.querySelector('.custom-details').open = true;
  document.getElementById('custom').value = '42, 7, 19, 3, 88';
  document.getElementById('customBtn').click();
  document.getElementById('bench').scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  document.getElementById('fwdBtn').focus({preventScroll: true});
});
