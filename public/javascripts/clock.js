(function() {
	var timeNode = document.querySelector('.clock__time'),
			dateNode = document.querySelector('.clock__date');

	var month = [
		'января',
		'февраля',
		'марта',
		'апреля',
		'мая',
		'июня',
		'июля',
		'августа',
		'сентября',
		'октября',
		'ноября',
		'декабря'
	];

	var day = [
		'воскресенье',
		'понедельник',
		'вторник',
		'среда',
		'четверг',
		'пятница',
		'суббота'
	];

	var date = new Date(Date.now());

	function getTime(time) {
		return time.getHours() + ':' + (time.getMinutes() < 10 ? '0' + time.getMinutes() : time.getMinutes());
	}

	function getDate(time) {
		return time.getDate() + ' ' + month[time.getMonth()] + ' ' + time.getFullYear() + ' ' + day[time.getDay()];
	}

	function setTime() {
		date = new Date(Date.now());

		timeNode.innerHTML = getTime(date);
		dateNode.innerHTML = getDate(date);
	} 

	function init() {
		setTime()

		setTimeout(function() {

			setTime();
			setInterval(setTime, 1000 * 60);

		}, 1000 * (60 - date.getSeconds()));
	}

	init();

})();