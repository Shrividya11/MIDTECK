const API_VERSION = 'MIDTEK_ADMIN_API_V14';

const SHEET_NAME = 'Products';
const CATEGORY_SHEET_NAME = 'Categories';
const CATEGORY_HEADERS = ['id','name','active','createdAt','updatedAt'];
const DEFAULT_CATEGORY = 'Uncategorized';
const HEADERS = [
  'id',
  'category',
  'name',
  'description',
  'price',
  'icon',
  'imageUrl'
];

// ============================================================
// ENQUIRY SETTINGS
// ============================================================

const ENQUIRY_SHEET_NAME = 'Enquiries';

const ENQUIRY_HEADERS = [
  'id',
  'date',
  'name',
  'email',
  'phone',
  'product',
  'message',
  'status'
];

// ============================================================
// GOOGLE DRIVE SETTINGS
// ============================================================

// Your actual Google Drive folder ID
const DRIVE_FOLDER_ID = '1xW3AKS3JmPY3cMYjxdri5_KbAZWhICbt';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;


// ============================================================
// PRODUCT SHEET
// ============================================================

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error(
      'This Apps Script must be bound to the MIDTEK Google Sheet. ' +
      'Open the Sheet, then Extensions > Apps Script.'
    );
  }

  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  return sheet;
}


function ensureHeaders_() {
  const sheet = getSheet_();

  const current = sheet
    .getRange(1, 1, 1, HEADERS.length)
    .getValues()[0];

  const matches = HEADERS.every(function (header, index) {
    return String(current[index] || '').trim() === header;
  });

  if (!matches) {
    sheet
      .getRange(1, 1, 1, HEADERS.length)
      .setValues([HEADERS]);
  }

  sheet.setFrozenRows(1);
}


// ============================================================
// CATEGORIES
// ============================================================

function getCategorySheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('This Apps Script must be bound to the MIDTEK Google Sheet.');
  let sheet = ss.getSheetByName(CATEGORY_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CATEGORY_SHEET_NAME);
  const current = sheet.getRange(1, 1, 1, CATEGORY_HEADERS.length).getValues()[0];
  const ok = CATEGORY_HEADERS.every((h, i) => String(current[i] || '').trim() === h);
  if (!ok) sheet.getRange(1, 1, 1, CATEGORY_HEADERS.length).setValues([CATEGORY_HEADERS]);
  sheet.setFrozenRows(1);
  return sheet;
}

function slugId_(name) {
  return String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'category';
}

function readCategories_() {
  const sheet = getCategorySheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, CATEGORY_HEADERS.length).getValues()
    .filter(r => r[0] !== '' && r[1] !== '')
    .map(r => ({
      id: String(r[0]),
      name: String(r[1]),
      active: !(r[2] === false || String(r[2]).toLowerCase() === 'false'),
      createdAt: String(r[3] || ''),
      updatedAt: String(r[4] || '')
    }));
}

function ensureCategoriesForProducts_(products) {
  const sheet = getCategorySheet_();
  const existing = readCategories_();
  const byName = {};
  existing.forEach(c => byName[c.name.trim().toLowerCase()] = c);
  const now = new Date().toISOString();
  const added = [];
  products.forEach(p => {
    const name = String(p.category || DEFAULT_CATEGORY).trim() || DEFAULT_CATEGORY;
    const key = name.toLowerCase();
    if (!byName[key]) {
      const id = slugId_(name) + '-' + Utilities.getUuid().slice(0, 6);
      const cat = {id, name, active:true, createdAt:now, updatedAt:now};
      sheet.appendRow([cat.id, cat.name, true, cat.createdAt, cat.updatedAt]);
      byName[key] = cat;
      added.push(cat);
    }
  });
  SpreadsheetApp.flush();
  return existing.concat(added);
}

function writeCategories_(categories) {
  const sheet = getCategorySheet_();
  const existingRows = Math.max(sheet.getLastRow() - 1, 0);
  if (existingRows) sheet.getRange(2,1,existingRows,CATEGORY_HEADERS.length).clearContent();
  if (categories.length) {
    const rows = categories.map(c => [
      String(c.id || slugId_(c.name)),
      String(c.name || '').trim(),
      c.active !== false,
      String(c.createdAt || new Date().toISOString()),
      new Date().toISOString()
    ]);
    sheet.getRange(2,1,rows.length,CATEGORY_HEADERS.length).setValues(rows);
  }
  sheet.setFrozenRows(1);
  SpreadsheetApp.flush();
}

// ============================================================
// READ PRODUCTS
// ============================================================

function readProducts_() {
  const sheet = getSheet_();

  ensureHeaders_();

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const values = sheet
    .getRange(
      2,
      1,
      lastRow - 1,
      HEADERS.length
    )
    .getValues();

  return values
    .filter(function (row) {
      return row[0] !== '' && row[0] !== null;
    })
    .map(function (row) {

      return {
        id: String(row[0]),
        category: String(row[1] || DEFAULT_CATEGORY),
        name: String(row[2] || ''),
        description: String(row[3] || ''),
        price: Number(row[4]) || 0,
        icon: String(row[5] || 'bulb'),
        imageUrl: String(row[6] || '')
      };

    });
}


// ============================================================
// WRITE PRODUCTS
// ============================================================

function writeProducts_(products) {

  const sheet = getSheet_();

  ensureHeaders_();

  const existingRows =
    Math.max(sheet.getLastRow() - 1, 0);

  if (existingRows > 0) {

    sheet
      .getRange(
        2,
        1,
        existingRows,
        HEADERS.length
      )
      .clearContent();
  }

  if (products.length) {

    const rows = products.map(function (p) {

      return [
        String(p.id || ''),
        String(p.category || DEFAULT_CATEGORY).trim() || DEFAULT_CATEGORY,
        String(p.name || '').trim(),
        String(p.description || '').trim(),
        Number(p.price) || 0,
        String(p.icon || 'bulb'),
        String(p.imageUrl || '')
      ];

    });

    sheet
      .getRange(
        2,
        1,
        rows.length,
        HEADERS.length
      )
      .setValues(rows);
  }

  sheet.setFrozenRows(1);

  SpreadsheetApp.flush();
}


// ============================================================
// JSON RESPONSE
// ============================================================

function jsonResponse_(obj) {

  return ContentService
    .createTextOutput(
      JSON.stringify(obj)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}


// ============================================================
// GOOGLE DRIVE
// ============================================================

function getDriveFolder_() {

  const folderId =
    String(DRIVE_FOLDER_ID || '').trim();

  if (!folderId) {

    throw new Error(
      'DRIVE_FOLDER_ID is not configured.'
    );
  }

  try {

    const folder =
      DriveApp.getFolderById(folderId);

    // Force access check
    folder.getName();

    return folder;

  } catch (err) {

    throw new Error(
      'Cannot access Google Drive folder. ' +
      'Check the folder ID and Drive permissions. ' +
      'Original error: ' +
      (err.message || String(err))
    );
  }
}


// ============================================================
// SAFE IMAGE FILE NAME
// ============================================================

function safeFileName_(name) {

  return String(
    name || 'product-image'
  )
    .replace(
      /[^a-zA-Z0-9._-]+/g,
      '-'
    )
    .replace(
      /-+/g,
      '-'
    )
    .replace(
      /^-|-$/g,
      ''
    )
    .slice(0, 90)
    || 'product-image';
}


// ============================================================
// UPLOAD PRODUCT IMAGE
// ============================================================

function uploadImage_(imageData, productName) {

  if (!imageData) {

    return {
      url: '',
      warning: ''
    };
  }

  const match = String(imageData).match(
    /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/
  );

  if (!match) {

    return {
      url: '',
      warning:
        'Invalid product image format. ' +
        'Expected JPG, PNG or WebP.'
    };
  }

  try {

    const mimeType = match[1];

    const bytes =
      Utilities.base64Decode(match[2]);

    if (!bytes || !bytes.length) {

      return {
        url: '',
        warning:
          'The uploaded image contained no data.'
      };
    }

    if (bytes.length > MAX_IMAGE_BYTES) {

      return {
        url: '',
        warning:
          'Product image is larger than the 5 MB server limit.'
      };
    }

    const extension =
      mimeType === 'image/png'
        ? 'png'
        : mimeType === 'image/webp'
          ? 'webp'
          : 'jpg';

    const fileName =
      safeFileName_(productName) +
      '-' +
      Utilities.getUuid().slice(0, 8) +
      '.' +
      extension;

    const folder =
      getDriveFolder_();

    const blob =
      Utilities.newBlob(
        bytes,
        mimeType,
        fileName
      );

    const file =
      folder.createFile(blob);

    let sharingWarning = '';

    try {

      file.setSharing(
        DriveApp.Access.ANYONE_WITH_LINK,
        DriveApp.Permission.VIEW
      );

    } catch (shareErr) {

      sharingWarning =
        ' Image uploaded to Drive, but public link sharing ' +
        'could not be enabled: ' +
        shareErr.message;
    }

    const id = file.getId();

    return {

      url:
        'https://drive.google.com/thumbnail?id=' +
        encodeURIComponent(id) +
        '&sz=w1600',

      fileId: id,

      fileName: file.getName(),

      folderName: folder.getName(),

      warning: sharingWarning
    };

  } catch (err) {

    return {

      url: '',

      warning:
        'Drive upload failed: ' +
        (err.message || String(err))
    };
  }
}


// ============================================================
// NORMALIZE PRODUCTS
// ============================================================

function normalizeProducts_(products) {

  const warnings = [];

  const normalized =
    products.map(function (p) {

      const copy = {

        id: String(p.id || ''),

        category:
          String(p.category || DEFAULT_CATEGORY).trim() || DEFAULT_CATEGORY,

        name:
          String(p.name || '').trim(),

        description:
          String(p.description || '').trim(),

        price:
          Math.max(
            0,
            Number(p.price) || 0
          ),

        icon:
          String(p.icon || 'bulb'),

        imageUrl:
          String(p.imageUrl || '')
      };


      // Upload image if supplied
      if (p.imageData) {

        const upload =
          uploadImage_(
            p.imageData,
            copy.name || copy.id
          );

        if (upload.url) {

          copy.imageUrl =
            upload.url;
        }

        if (upload.warning) {

          warnings.push(
            'Image for "' +
            copy.name +
            '": ' +
            upload.warning
          );
        }

        if (upload.fileId) {

          copy.imageFileId =
            upload.fileId;
        }
      }

      return copy;

    });

  return {
    products: normalized,
    warnings: warnings
  };
}


// ============================================================
// ENQUIRY SHEET
// ============================================================

function getEnquirySheet_() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {

    throw new Error(
      'This Apps Script must be bound to the MIDTEK Google Sheet.'
    );
  }

  let sheet =
    ss.getSheetByName(
      ENQUIRY_SHEET_NAME
    );

  if (!sheet) {

    sheet =
      ss.insertSheet(
        ENQUIRY_SHEET_NAME
      );
  }

  const currentHeaders =
    sheet
      .getRange(
        1,
        1,
        1,
        ENQUIRY_HEADERS.length
      )
      .getValues()[0];

  const headersMatch =
    ENQUIRY_HEADERS.every(
      function (header, index) {

        return String(
          currentHeaders[index] || ''
        ).trim() === header;

      }
    );

  if (!headersMatch) {

    sheet
      .getRange(
        1,
        1,
        1,
        ENQUIRY_HEADERS.length
      )
      .setValues([
        ENQUIRY_HEADERS
      ]);
  }

  sheet.setFrozenRows(1);

  return sheet;
}


// ============================================================
// SAVE ENQUIRY
// ============================================================

function saveEnquiry_(data) {

  const name =
    String(data.name || '').trim();

  const email =
    String(data.email || '').trim();

  const phone =
    String(data.phone || '').trim();

  const product =
    String(data.product || '').trim();

  const message =
    String(data.message || '').trim();


  // ----------------------------------------------------------
  // SERVER-SIDE VALIDATION
  // ----------------------------------------------------------

  if (name.length < 2) {

    throw new Error(
      'Please enter a valid name.'
    );
  }

  if (name.length > 100) {

    throw new Error(
      'Name is too long.'
    );
  }


  // Email validation

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
      .test(email)
  ) {

    throw new Error(
      'Please enter a valid email address.'
    );
  }

  if (email.length > 150) {

    throw new Error(
      'Email address is too long.'
    );
  }


  // Phone validation

  if (phone) {

    const cleanedPhone =
      phone.replace(
        /[\s()+-]/g,
        ''
      );

    if (
      !/^\d{7,15}$/.test(
        cleanedPhone
      )
    ) {

      throw new Error(
        'Please enter a valid phone number.'
      );
    }
  }


  // Message validation

  if (message.length < 10) {

    throw new Error(
      'Please provide at least 10 characters ' +
      'in your message.'
    );
  }

  if (message.length > 2000) {

    throw new Error(
      'Message must be less than 2000 characters.'
    );
  }


  // Product validation

  if (product.length > 200) {

    throw new Error(
      'Product name is too long.'
    );
  }


  // ----------------------------------------------------------
  // SAVE
  // ----------------------------------------------------------

  const sheet =
    getEnquirySheet_();

  const enquiryId =
    'ENQ-' +
    Utilities
      .getUuid()
      .replace(/-/g, '')
      .substring(0, 12)
      .toUpperCase();

  const timestamp =
    new Date();


  sheet.appendRow([

    enquiryId,

    timestamp,

    name,

    email,

    phone,

    product,

    message,

    'New'

  ]);


  SpreadsheetApp.flush();


  return {

    id: enquiryId,

    date:
      timestamp.toISOString(),

    name: name,

    email: email,

    phone: phone,

    product: product,

    message: message,

    status: 'New'
  };
}


// ============================================================
// DRIVE TEST
// ============================================================

function testDriveFolder() {

  const folder =
    getDriveFolder_();

  Logger.log(
    'Drive folder access OK: ' +
    folder.getName() +
    ' | ID: ' +
    folder.getId()
  );

  return folder.getId();
}


// ============================================================
// DRIVE UPLOAD TEST
// ============================================================

function testDriveUpload() {

  const folder =
    getDriveFolder_();

  const blob =
    Utilities.newBlob(
      'MIDTEK Drive upload test',
      'text/plain',
      'midtek-drive-test.txt'
    );

  const file =
    folder.createFile(blob);

  Logger.log(
    'UPLOAD SUCCESS'
  );

  Logger.log(
    'Folder: ' +
    folder.getName()
  );

  Logger.log(
    'File: ' +
    file.getName()
  );

  Logger.log(
    'File ID: ' +
    file.getId()
  );

  return file.getId();
}


// Short server-side cache for public catalogue reads. This reduces repeated
// spreadsheet reads without affecting admin authentication or writes.
const PUBLIC_CACHE_SECONDS = 60;
const PUBLIC_CACHE_KEY = 'midtek_public_catalogue_v1';

function clearPublicCache_() {
  try { CacheService.getScriptCache().remove(PUBLIC_CACHE_KEY); } catch (_) {}
}

function getPublicCatalogue_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(PUBLIC_CACHE_KEY);
  if (cached) return JSON.parse(cached);

  const result = {
    products: readProducts_(),
    categories: readCategories_().filter(c => c.active)
  };
  try { cache.put(PUBLIC_CACHE_KEY, JSON.stringify(result), PUBLIC_CACHE_SECONDS); } catch (_) {}
  return result;
}

// ============================================================
// GET
// ============================================================

function doGet(e) {

  try {

    const action =
      String(
        (e &&
          e.parameter &&
          e.parameter.action) ||
        'products'
      );


    if (action === 'health') {

      return jsonResponse_({

        ok: true,

        apiVersion:
          API_VERSION,

        service:
          'MIDTEK Product API'
      });
    }


    const catalogue = getPublicCatalogue_();

    return jsonResponse_({
      ok: true,
      apiVersion: API_VERSION,
      products: catalogue.products,
      categories: catalogue.categories
    });


  } catch (err) {

    return jsonResponse_({

      ok: false,

      apiVersion:
        API_VERSION,

      error:
        String(err)
    });
  }
}


// ============================================================
// POST
// ============================================================

function doPost(e) {

  try {

    const raw =
      (e &&
        e.postData &&
        e.postData.contents) ||
      '{}';

    const body =
      JSON.parse(raw);

    const action =
      String(body.action || '');


    // ========================================================
    // PUBLIC ENQUIRY
    // IMPORTANT:
    // This MUST be before ADMIN_PASSWORD checking.
    // ========================================================

    if (action === 'enquiry') {

      try {

        const enquiry =
          saveEnquiry_(body);

        return jsonResponse_({

          ok: true,

          apiVersion:
            API_VERSION,

          message:
            'Enquiry saved successfully.',

          enquiry:
            enquiry

        });

      } catch (err) {

        return jsonResponse_({

          ok: false,

          apiVersion:
            API_VERSION,

          error:
            err.message ||
            String(err)

        });
      }
    }


    // ========================================================
    // ADMIN PASSWORD
    // ========================================================

    const expected =
      PropertiesService
        .getScriptProperties()
        .getProperty(
          'ADMIN_PASSWORD'
        );


    if (!expected) {

      return jsonResponse_({

        ok: false,

        apiVersion:
          API_VERSION,

        error:
          'Server has no ADMIN_PASSWORD set. ' +
          'Add it in Script Properties.'
      });
    }


    // ========================================================
    // ADMIN LOGIN
    // ========================================================

    if (action === 'login') {

      if (
        String(body.password || '') !==
        expected
      ) {

        return jsonResponse_({

          ok: false,

          apiVersion:
            API_VERSION,

          error:
            'Wrong password.'
        });
      }


      return jsonResponse_({

        ok: true,

        apiVersion:
          API_VERSION
      });
    }


    // ========================================================
    // ADMIN SAVE PRODUCTS
    // ========================================================

    if (action === 'save') {

      if (
        String(body.password || '') !==
        expected
      ) {

        return jsonResponse_({

          ok: false,

          apiVersion:
            API_VERSION,

          auth: false,

          error:
            'Invalid admin password. ' +
            'Please sign in again.'
        });
      }


      if (
        !Array.isArray(body.products)
      ) {

        return jsonResponse_({

          ok: false,

          apiVersion:
            API_VERSION,

          error:
            'Missing products array.'
        });
      }


      if (
        body.products.length > 100
      ) {

        return jsonResponse_({

          ok: false,

          apiVersion:
            API_VERSION,

          error:
            'Too many products.'
        });
      }


      const normalized =
        normalizeProducts_(
          body.products
        );

      // Categories are persisted together with the catalogue. Any category
      // used by a product is automatically created if it does not exist.
      const syncedCategories = ensureCategoriesForProducts_(normalized.products);

      // Save products even if an image upload fails.
      writeProducts_(normalized.products);

      // Persist explicit category changes from the admin UI. Merge the
      // server-created product categories so a newly typed category can never
      // disappear when the Categories sheet is rewritten.
      let categoriesToWrite = syncedCategories.slice();

      if (Array.isArray(body.categories)) {
        const cleaned = body.categories
          .map(c => ({
            id: String(c.id || '').trim(),
            name: String(c.name || '').trim(),
            active: c.active !== false,
            createdAt: String(c.createdAt || '').trim()
          }))
          .filter(c => c.name);

        const byName = {};
        categoriesToWrite.forEach(c => {
          byName[String(c.name).trim().toLowerCase()] = c;
        });

        cleaned.forEach(c => {
          const key = c.name.toLowerCase();
          const existing = byName[key];
          if (existing) {
            existing.id = c.id || existing.id;
            existing.name = c.name;
            existing.active = c.active;
            existing.createdAt = c.createdAt || existing.createdAt;
          } else {
            byName[key] = c;
            categoriesToWrite.push(c);
          }
        });

        const productNames = {};
        normalized.products.forEach(p => {
          productNames[String(p.category).trim().toLowerCase()] = true;
        });
        categoriesToWrite.forEach(c => {
          if (productNames[String(c.name).trim().toLowerCase()]) c.active = true;
        });
      }

      writeCategories_(categoriesToWrite);
      clearPublicCache_();

      return jsonResponse_({
        ok: true,
        apiVersion: API_VERSION,
        products: normalized.products,
        categories: readCategories_().filter(c => c.active),
        warnings: normalized.warnings
      });
    }


    // ========================================================
    // UNKNOWN ACTION
    // ========================================================

    return jsonResponse_({

      ok: false,

      apiVersion:
        API_VERSION,

      error:
        'Unknown action: ' +
        action
    });


  } catch (err) {

    return jsonResponse_({

      ok: false,

      apiVersion:
        API_VERSION,

      error:
        String(err)
    });
  }
}