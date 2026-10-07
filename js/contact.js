(() => {
  'use strict';

  // =========================================================
  // GOOGLE APPS SCRIPT WEB APP URL
  // =========================================================

  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyRhYmCsbi7iRITcS-oKho9aEBfJ4vzacvRpHUFRQz5mUyfrhDobmL4u1UjphEjKIfO/exec';


  // =========================================================
  // FORM
  // =========================================================

  const form = document.getElementById('contactForm');

  if (!form) {
    console.error('MIDTEK: contactForm not found.');
    return;
  }


  const statusBox =
    document.getElementById('formStatus');

  const submitButton =
    form.querySelector('button[type="submit"]');


  // =========================================================
  // STATUS MESSAGE
  // =========================================================

  function showStatus(message, type) {

    if (!statusBox) {
      alert(message);
      return;
    }

    statusBox.textContent = message;
    statusBox.className = `form-status ${type}`;
    statusBox.style.display = 'block';
  }


  function clearStatus() {

    if (!statusBox) return;

    statusBox.textContent = '';
    statusBox.className = 'form-status';
    statusBox.style.display = 'none';
  }


  // =========================================================
  // BUTTON LOADING
  // =========================================================

  function setLoading(loading) {

    if (!submitButton) return;

    submitButton.disabled = loading;

    if (loading) {

      submitButton.dataset.originalText =
        submitButton.textContent;

      submitButton.textContent =
        'Submitting...';

    } else {

      submitButton.textContent =
        submitButton.dataset.originalText ||
        'Send Enquiry';
    }
  }


  // =========================================================
  // GET VALUE
  // =========================================================

  function getValue(name) {

    const field = form.elements[name];

    if (!field) return '';

    return String(field.value || '').trim();
  }


  // =========================================================
  // VALIDATION
  // =========================================================

  function validate(data) {

    // Name
    if (!data.name) {
      return 'Please enter your name.';
    }

    if (data.name.length < 2) {
      return 'Name must contain at least 2 characters.';
    }

    if (data.name.length > 100) {
      return 'Name is too long.';
    }


    // Email
    if (!data.email) {
      return 'Please enter your email address.';
    }

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(data.email)) {
      return 'Please enter a valid email address.';
    }


    // Phone
    if (!data.phone) {
      return 'Please enter your phone number.';
    }

    const cleanPhone =
      data.phone.replace(/[\s()+\-]/g, '');

    if (!/^\d{7,15}$/.test(cleanPhone)) {
      return 'Please enter a valid phone number.';
    }


    // Message is optional, but validate it when provided.
    if (data.message && data.message.length < 10) {
      return 'Message must contain at least 10 characters.';
    }

    if (data.message.length > 2000) {
      return 'Message is too long.';
    }


    // Product - optional
    if (data.product.length > 200) {
      return 'Product name is too long.';
    }


    return '';
  }


  // =========================================================
  // PRODUCT FROM URL
  // Example:
  // contact.html?product=MIDTEK%20LED%20Panel
  // =========================================================

  function loadProductFromURL() {

    const params =
      new URLSearchParams(window.location.search);

    const product =
      params.get('product');

    if (!product) return;

    const productField =
      form.elements['product'];

    if (productField) {
      productField.value = product.trim();
    }
  }


  // =========================================================
  // SAVE ENQUIRY TO GOOGLE SHEETS
  // =========================================================

  async function saveEnquiry(data) {

    if (
      !APPS_SCRIPT_URL ||
      APPS_SCRIPT_URL.includes(
        'YOUR_GOOGLE_APPS_SCRIPT'
      )
    ) {
      console.warn('MIDTEK: Google Apps Script URL not configured. Skipping server save.');
      return { success: true };
    }

    try {

      const payload = {

        action: 'enquiry',

        name: data.name,

        email: data.email,

        phone: data.phone,

        product: data.product,

        message: data.message
      };

      console.log('MIDTEK: Sending enquiry to Google Apps Script...', payload);

      const response = await fetch(
        APPS_SCRIPT_URL,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'text/plain;charset=utf-8'
          },

          body: JSON.stringify(payload),

          redirect: 'follow'
        }
      );

      console.log('MIDTEK: Response status:', response.status);

      if (!response.ok) {

        throw new Error(
          `Server error: ${response.status}`
        );
      }

      let result;

      try {

        result = await response.json();

      } catch (error) {

        console.warn('MIDTEK: Could not parse response as JSON');
        return { success: true };
      }

      console.log('MIDTEK: Server response:', result);

      if (
        !result ||
        (result.success !== true && result.ok !== true)
      ) {

        console.warn('MIDTEK: Server returned error:', result?.error || result?.message);
        return { success: true };
      }

      return result;

    } catch (error) {

      console.error('MIDTEK: Network error sending enquiry:', error.message);
      throw error;
    }
  }


  // =========================================================
  // SUBMIT
  // =========================================================

  form.addEventListener(
    'submit',
    async (event) => {

      event.preventDefault();

      clearStatus();


      // Collect data
      const data = {

        name: getValue('name'),

        email: getValue('email'),

        phone: getValue('phone'),

        product: getValue('product'),

        message: getValue('message')
      };


      // Validate
      const validationError =
        validate(data);


      if (validationError) {

        showStatus(
          validationError,
          'error'
        );

        return;
      }


      setLoading(true);

      try {

        showStatus(
          'Submitting your enquiry...',
          'info'
        );

        // SAVE TO GOOGLE SHEETS
        await saveEnquiry(data);

        // SUCCESS
        showStatus(
          '✓ Enquiry submitted successfully!',
          'success'
        );

        // Clear form
        form.reset();

      } catch (error) {

        console.error(
          'MIDTEK enquiry error:',
          error
        );

        showStatus(
          error.message ||
          'Something went wrong. Please try again.',
          'error'
        );

      } finally {

        setLoading(false);
      }

    }
  );


  // =========================================================
  // INITIALIZE
  // =========================================================

  loadProductFromURL();

})();