## Classes

<dl>
<dt><a href="#ShopRepositoryImpl">ShopRepositoryImpl</a></dt>
<dd></dd>
<dt><a href="#CustomerDataRepositoryImpl">CustomerDataRepositoryImpl</a></dt>
<dd></dd>
<dt><a href="#FetchError">FetchError</a></dt>
<dd></dd>
</dl>

<a name="ShopRepositoryImpl"></a>

## ShopRepositoryImpl
**Kind**: global class  

* [ShopRepositoryImpl](#ShopRepositoryImpl)
    * [new ShopRepositoryImpl(database)](#new_ShopRepositoryImpl_new)
    * [.getShop(shopUrl)](#ShopRepositoryImpl+getShop) ⇒ <code>Promise.&lt;(Shop\|null)&gt;</code>
    * [.createShop(data)](#ShopRepositoryImpl+createShop) ⇒ <code>Promise.&lt;Shop&gt;</code>
    * [.updateShop(shopUrl, data)](#ShopRepositoryImpl+updateShop) ⇒ <code>Promise.&lt;Shop&gt;</code>
    * [.deleteShop(shopUrl)](#ShopRepositoryImpl+deleteShop) ⇒ <code>Promise.&lt;Shop&gt;</code>

<a name="new_ShopRepositoryImpl_new"></a>

### new ShopRepositoryImpl(database)
Creates a new ShopRepositoryImpl instance.


| Param | Type | Description |
| --- | --- | --- |
| database | <code>PrismaClient</code> | The Prisma client instance used for database operations. |

<a name="ShopRepositoryImpl+getShop"></a>

### shopRepositoryImpl.getShop(shopUrl) ⇒ <code>Promise.&lt;(Shop\|null)&gt;</code>
Retrieves a shop by its URL.

**Kind**: instance method of [<code>ShopRepositoryImpl</code>](#ShopRepositoryImpl)  
**Returns**: <code>Promise.&lt;(Shop\|null)&gt;</code> - A promise that resolves to the Shop object if found, or null otherwise.  

| Param | Type | Description |
| --- | --- | --- |
| shopUrl | <code>string</code> | The unique URL identifier of the shop. |

<a name="ShopRepositoryImpl+createShop"></a>

### shopRepositoryImpl.createShop(data) ⇒ <code>Promise.&lt;Shop&gt;</code>
Creates a new shop record.

**Kind**: instance method of [<code>ShopRepositoryImpl</code>](#ShopRepositoryImpl)  
**Returns**: <code>Promise.&lt;Shop&gt;</code> - A promise that resolves to the newly created Shop object.  

| Param | Type | Description |
| --- | --- | --- |
| data | <code>ShopCreate</code> | The data used to create the shop. |

<a name="ShopRepositoryImpl+updateShop"></a>

### shopRepositoryImpl.updateShop(shopUrl, data) ⇒ <code>Promise.&lt;Shop&gt;</code>
Updates an existing shop by its URL.

**Kind**: instance method of [<code>ShopRepositoryImpl</code>](#ShopRepositoryImpl)  
**Returns**: <code>Promise.&lt;Shop&gt;</code> - A promise that resolves to the updated Shop object.  

| Param | Type | Description |
| --- | --- | --- |
| shopUrl | <code>string</code> | The unique URL identifier of the shop to update. |
| data | <code>ShopUpdate</code> | The data used to update the shop. |

<a name="ShopRepositoryImpl+deleteShop"></a>

### shopRepositoryImpl.deleteShop(shopUrl) ⇒ <code>Promise.&lt;Shop&gt;</code>
Deletes a shop by its URL.

**Kind**: instance method of [<code>ShopRepositoryImpl</code>](#ShopRepositoryImpl)  
**Returns**: <code>Promise.&lt;Shop&gt;</code> - A promise that resolves to the deleted Shop object.  

| Param | Type | Description |
| --- | --- | --- |
| shopUrl | <code>string</code> | The unique URL identifier of the shop to delete. |

<a name="CustomerDataRepositoryImpl"></a>

## CustomerDataRepositoryImpl
**Kind**: global class  

* [CustomerDataRepositoryImpl](#CustomerDataRepositoryImpl)
    * [new CustomerDataRepositoryImpl(database)](#new_CustomerDataRepositoryImpl_new)
    * [.createCustomerDataRequest(data)](#CustomerDataRepositoryImpl+createCustomerDataRequest) ⇒ <code>Promise.&lt;GdprCustomerDataRequest&gt;</code>

<a name="new_CustomerDataRepositoryImpl_new"></a>

### new CustomerDataRepositoryImpl(database)
Creates a new instance of CustomerDataRepositoryImpl.


| Param | Type | Description |
| --- | --- | --- |
| database | <code>PrismaClient</code> | The Prisma client instance for database operations. |

<a name="CustomerDataRepositoryImpl+createCustomerDataRequest"></a>

### customerDataRepositoryImpl.createCustomerDataRequest(data) ⇒ <code>Promise.&lt;GdprCustomerDataRequest&gt;</code>
Creates a new GDPR customer data request record in the database.

**Kind**: instance method of [<code>CustomerDataRepositoryImpl</code>](#CustomerDataRepositoryImpl)  
**Returns**: <code>Promise.&lt;GdprCustomerDataRequest&gt;</code> - A promise that resolves to the created GDPR customer data request entity.  

| Param | Type | Description |
| --- | --- | --- |
| data | <code>CustomerDataRequestCreate</code> | The data required to create the GDPR customer data request. |

<a name="FetchError"></a>

## FetchError
**Kind**: global class  
<a name="new_FetchError_new"></a>

### new FetchError(message, status)
Creates a new FetchError instance.


| Param | Type | Description |
| --- | --- | --- |
| message | <code>string</code> | The error message. |
| status | <code>number</code> | The HTTP status code associated with the error. |

