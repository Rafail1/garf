(function() {
		var inputs = document.querySelectorAll('input[type="file"]');

		Array.prototype.forEach.call(inputs, function(input) {
			var statusNode = input.nextElementSibling,
  				statusHtml = statusNode.innerHTML,
  				labelNode  = input.previousElementSibling;

  		input.addEventListener('change', function() {
  			if (this.files && this.files.length > 0) {
  				var name = this.files[0].name;

  				if (name.length > 28)
  					fileName = name.substr(0, 17) + '...' + name.substr(name.length - 8, 8);
  				else
  					fileName = this.files[0].name;

  				labelNode.classList.add('ok');
  				statusNode.style.color = '#2a965d';
  			}
  			else {
  				fileName = statusHtml;

  				labelNode.classList.remove('ok');
  				statusNode.style.color = '';
  			}

  			statusNode.innerHTML = fileName;
  		})
		})
})()