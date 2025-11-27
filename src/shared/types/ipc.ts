export enum IpcChannel {
  // Client operations
  GET_CLIENTS = 'db:get-clients',
  GET_CLIENT = 'db:get-client',
  GET_CLIENT_BY_EMAIL = 'db:get-client-by-email',
  SEARCH_CLIENTS = 'db:search-clients',
  CREATE_CLIENT = 'db:create-client',
  UPDATE_CLIENT = 'db:update-client',
  DELETE_CLIENT = 'db:delete-client',

  // Employee operations
  GET_EMPLOYEES = 'db:get-employees',
  GET_EMPLOYEE = 'db:get-employee',
  GET_EMPLOYEE_BY_USERNAME = 'db:get-employee-by-username',
  GET_ACTIVE_EMPLOYEES = 'db:get-active-employees',
  SEARCH_EMPLOYEES = 'db:search-employees',
  CREATE_EMPLOYEE = 'db:create-employee',
  UPDATE_EMPLOYEE = 'db:update-employee',
  DELETE_EMPLOYEE = 'db:delete-employee',

  // Part operations
  GET_PARTS = 'db:get-parts',
  GET_PART = 'db:get-part',
  GET_PART_BY_SKU = 'db:get-part-by-sku',
  SEARCH_PARTS = 'db:search-parts',
  CREATE_PART = 'db:create-part',
  UPDATE_PART = 'db:update-part',
  DELETE_PART = 'db:delete-part',

  // Part variant operations
  GET_PART_VARIANTS = 'db:get-part-variants',
  GET_PART_VARIANT = 'db:get-part-variant',
  GET_VARIANTS_BY_PART = 'db:get-variants-by-part',
  GET_ACTIVE_VARIANTS = 'db:get-active-variants',
  GET_LOW_STOCK_VARIANTS = 'db:get-low-stock-variants',
  CREATE_PART_VARIANT = 'db:create-part-variant',
  UPDATE_PART_VARIANT = 'db:update-part-variant',
  DELETE_PART_VARIANT = 'db:delete-part-variant',
  UPDATE_VARIANT_STOCK = 'db:update-variant-stock',

  // Invoice operations
  GET_INVOICES = 'db:get-invoices',
  GET_INVOICE = 'db:get-invoice',
  GET_INVOICES_BY_CLIENT = 'db:get-invoices-by-client',
  GET_UNPAID_INVOICES = 'db:get-unpaid-invoices',
  CREATE_INVOICE = 'db:create-invoice',
  UPDATE_INVOICE = 'db:update-invoice',
  DELETE_INVOICE = 'db:delete-invoice',
  RECORD_PAYMENT = 'db:record-payment',

  // Invoice item operations
  GET_INVOICE_ITEMS = 'db:get-invoice-items',
  CREATE_INVOICE_ITEM = 'db:create-invoice-item',
  CREATE_INVOICE_ITEMS_BULK = 'db:create-invoice-items-bulk',
  UPDATE_INVOICE_ITEM = 'db:update-invoice-item',
  DELETE_INVOICE_ITEM = 'db:delete-invoice-item',

  // Payment operations
  GET_PAYMENTS = 'db:get-payments',
  GET_PAYMENT = 'db:get-payment',
  GET_PAYMENTS_BY_INVOICE = 'db:get-payments-by-invoice',
  CREATE_PAYMENT = 'db:create-payment',
  UPDATE_PAYMENT = 'db:update-payment',
  DELETE_PAYMENT = 'db:delete-payment',

  // Payment method operations
  GET_PAYMENT_METHODS = 'db:get-payment-methods',
  GET_ACTIVE_PAYMENT_METHODS = 'db:get-active-payment-methods',
  CREATE_PAYMENT_METHOD = 'db:create-payment-method',
  UPDATE_PAYMENT_METHOD = 'db:update-payment-method',
  DELETE_PAYMENT_METHOD = 'db:delete-payment-method',

  // Quotation operations
  GET_QUOTATIONS = 'db:get-quotations',
  GET_QUOTATION = 'db:get-quotation',
  GET_QUOTATIONS_BY_CLIENT = 'db:get-quotations-by-client',
  CREATE_QUOTATION = 'db:create-quotation',
  UPDATE_QUOTATION = 'db:update-quotation',
  DELETE_QUOTATION = 'db:delete-quotation',
  CONVERT_QUOTATION_TO_INVOICE = 'db:convert-quotation-to-invoice',

  // Quotation item operations
  GET_QUOTATION_ITEMS = 'db:get-quotation-items',
  CREATE_QUOTATION_ITEM = 'db:create-quotation-item',
  CREATE_QUOTATION_ITEMS_BULK = 'db:create-quotation-items-bulk',
  UPDATE_QUOTATION_ITEM = 'db:update-quotation-item',
  DELETE_QUOTATION_ITEM = 'db:delete-quotation-item',

  // Credit note operations
  GET_CREDIT_NOTES = 'db:get-credit-notes',
  GET_CREDIT_NOTE = 'db:get-credit-note',
  GET_CREDIT_NOTES_BY_CLIENT = 'db:get-credit-notes-by-client',
  GET_UNALLOCATED_CREDIT_NOTES = 'db:get-unallocated-credit-notes',
  CREATE_CREDIT_NOTE = 'db:create-credit-note',
  UPDATE_CREDIT_NOTE = 'db:update-credit-note',
  DELETE_CREDIT_NOTE = 'db:delete-credit-note',

  // Credit note allocation operations
  GET_CREDIT_NOTE_ALLOCATIONS = 'db:get-credit-note-allocations',
  CREATE_CREDIT_NOTE_ALLOCATION = 'db:create-credit-note-allocation',
  UPDATE_CREDIT_NOTE_ALLOCATION = 'db:update-credit-note-allocation',
  DELETE_CREDIT_NOTE_ALLOCATION = 'db:delete-credit-note-allocation',

  // Vehicle model operations
  GET_VEHICLE_MODELS = 'db:get-vehicle-models',
  GET_VEHICLE_MODEL = 'db:get-vehicle-model',
  SEARCH_VEHICLE_MODELS = 'db:search-vehicle-models',
  CREATE_VEHICLE_MODEL = 'db:create-vehicle-model',
  UPDATE_VEHICLE_MODEL = 'db:update-vehicle-model',
  DELETE_VEHICLE_MODEL = 'db:delete-vehicle-model',

  // Part model operations
  GET_PART_MODELS_BY_PART = 'db:get-part-models-by-part',
  GET_PART_MODELS_BY_VEHICLE = 'db:get-part-models-by-vehicle',
  CREATE_PART_MODEL = 'db:create-part-model',
  CREATE_PART_MODELS_BULK = 'db:create-part-models-bulk',
  UPDATE_PART_MODEL = 'db:update-part-model',
  DELETE_PART_MODEL = 'db:delete-part-model',

  // Database configuration operations
  GET_DATABASE_CONFIG = 'db:get-config',
  UPDATE_DATABASE_CONFIG = 'db:update-config',
  TEST_DATABASE_CONNECTION = 'db:test-connection',
  RECONNECT_DATABASE = 'db:reconnect',
}
