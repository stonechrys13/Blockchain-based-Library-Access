(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-HASH u101)
(define-constant ERR-INVALID-TITLE u102)
(define-constant ERR-INVALID-DESCRIPTION u103)
(define-constant ERR-INVALID-IPFS-LINK u104)
(define-constant ERR-RESOURCE-ALREADY-EXISTS u105)
(define-constant ERR-RESOURCE-NOT-FOUND u106)
(define-constant ERR-INVALID-TIMESTAMP u107)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u108)
(define-constant ERR-INVALID-CATEGORY u109)
(define-constant ERR-INVALID-STATUS u110)
(define-constant ERR-INVALID-OWNER u111)
(define-constant ERR-UPDATE-NOT-ALLOWED u112)
(define-constant ERR-INVALID-UPDATE-PARAM u113)
(define-constant ERR-MAX-RESOURCES-EXCEEDED u114)
(define-constant ERR-INVALID-FORMAT u115)
(define-constant ERR-INVALID-VISIBILITY u116)
(define-constant ERR-INVALID-LICENSE u117)
(define-constant ERR-INVALID-MAX-VERSIONS u118)
(define-constant ERR-INVALID-VERSION u119)
(define-constant ERR-INVALID-ACCESS-FEE u120)

(define-data-var next-resource-id uint u0)
(define-data-var max-resources uint u10000)
(define-data-var registration-fee uint u500)
(define-data-var authority-contract (optional principal) none)

(define-map resources
  uint
  {
    hash: (buff 32),
    title: (string-ascii 100),
    description: (string-ascii 500),
    ipfs-link: (string-ascii 200),
    owner: principal,
    registered-at: uint,
    category: (string-ascii 50),
    status: bool,
    format: (string-ascii 20),
    visibility: bool,
    license: (string-ascii 50),
    max-versions: uint,
    current-version: uint,
    access-fee: uint
  }
)

(define-map resources-by-hash
  { hash: (buff 32) }
  uint
)

(define-map resource-updates
  uint
  {
    update-title: (string-ascii 100),
    update-description: (string-ascii 500),
    update-ipfs-link: (string-ascii 200),
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-resource (id uint))
  (map-get? resources id)
)

(define-read-only (get-resource-updates (id uint))
  (map-get? resource-updates id)
)

(define-read-only (is-resource-registered (hash (buff 32)))
  (is-some (map-get? resources-by-hash { hash: hash }))
)

(define-private (validate-hash (hash (buff 32)))
  (if (is-eq (len hash) u32)
      (ok true)
      (err ERR-INVALID-HASH))
)

(define-private (validate-title (title (string-ascii 100)))
  (if (and (> (len title) u0) (<= (len title) u100))
      (ok true)
      (err ERR-INVALID-TITLE))
)

(define-private (validate-description (description (string-ascii 500)))
  (if (<= (len description) u500)
      (ok true)
      (err ERR-INVALID-DESCRIPTION))
)

(define-private (validate-ipfs-link (link (string-ascii 200)))
  (if (and (> (len link) u0) (<= (len link) u200))
      (ok true)
      (err ERR-INVALID-IPFS-LINK))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-category (cat (string-ascii 50)))
  (if (or (is-eq cat "ebook") (is-eq cat "article") (is-eq cat "video") (is-eq cat "audio"))
      (ok true)
      (err ERR-INVALID-CATEGORY))
)

(define-private (validate-format (fmt (string-ascii 20)))
  (if (or (is-eq fmt "PDF") (is-eq fmt "EPUB") (is-eq fmt "MP4") (is-eq fmt "MP3"))
      (ok true)
      (err ERR-INVALID-FORMAT))
)

(define-private (validate-license (lic (string-ascii 50)))
  (if (or (is-eq lic "CC-BY") (is-eq lic "CC-BY-SA") (is-eq lic "Public Domain"))
      (ok true)
      (err ERR-INVALID-LICENSE))
)

(define-private (validate-max-versions (maxv uint))
  (if (and (> maxv u0) (<= maxv u10))
      (ok true)
      (err ERR-INVALID-MAX-VERSIONS))
)

(define-private (validate-version (ver uint))
  (if (> ver u0)
      (ok true)
      (err ERR-INVALID-VERSION))
)

(define-private (validate-access-fee (fee uint))
  (if (<= fee u10000)
      (ok true)
      (err ERR-INVALID-ACCESS-FEE))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-INVALID-OWNER))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-resources (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-MAX-RESOURCES-EXCEEDED))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-resources new-max)
    (ok true)
  )
)

(define-public (set-registration-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set registration-fee new-fee)
    (ok true)
  )
)

(define-public (register-resource
  (hash (buff 32))
  (title (string-ascii 100))
  (description (string-ascii 500))
  (ipfs-link (string-ascii 200))
  (category (string-ascii 50))
  (format (string-ascii 20))
  (visibility bool)
  (license (string-ascii 50))
  (max-versions uint)
  (access-fee uint)
)
  (let (
        (next-id (var-get next-resource-id))
        (current-max (var-get max-resources))
        (authority (var-get authority-contract))
      )
    (asserts! (< next-id current-max) (err ERR-MAX-RESOURCES-EXCEEDED))
    (try! (validate-hash hash))
    (try! (validate-title title))
    (try! (validate-description description))
    (try! (validate-ipfs-link ipfs-link))
    (try! (validate-category category))
    (try! (validate-format format))
    (try! (validate-license license))
    (try! (validate-max-versions max-versions))
    (try! (validate-access-fee access-fee))
    (asserts! (not (is-resource-registered hash)) (err ERR-RESOURCE-ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get registration-fee) tx-sender authority-recipient))
    )
    (map-set resources next-id
      {
        hash: hash,
        title: title,
        description: description,
        ipfs-link: ipfs-link,
        owner: tx-sender,
        registered-at: block-height,
        category: category,
        status: true,
        format: format,
        visibility: visibility,
        license: license,
        max-versions: max-versions,
        current-version: u1,
        access-fee: access-fee
      }
    )
    (map-set resources-by-hash { hash: hash } next-id)
    (var-set next-resource-id (+ next-id u1))
    (print { event: "resource-registered", id: next-id })
    (ok next-id)
  )
)

(define-public (update-resource
  (resource-id uint)
  (update-title (string-ascii 100))
  (update-description (string-ascii 500))
  (update-ipfs-link (string-ascii 200))
  (new-version uint)
)
  (let ((resource (map-get? resources resource-id)))
    (match resource
      r
        (begin
          (asserts! (is-eq (get owner r) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-title update-title))
          (try! (validate-description update-description))
          (try! (validate-ipfs-link update-ipfs-link))
          (try! (validate-version new-version))
          (asserts! (<= new-version (get max-versions r)) (err ERR-INVALID-VERSION))
          (map-set resources resource-id
            {
              hash: (get hash r),
              title: update-title,
              description: update-description,
              ipfs-link: update-ipfs-link,
              owner: (get owner r),
              registered-at: (get registered-at r),
              category: (get category r),
              status: (get status r),
              format: (get format r),
              visibility: (get visibility r),
              license: (get license r),
              max-versions: (get max-versions r),
              current-version: new-version,
              access-fee: (get access-fee r)
            }
          )
          (map-set resource-updates resource-id
            {
              update-title: update-title,
              update-description: update-description,
              update-ipfs-link: update-ipfs-link,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "resource-updated", id: resource-id })
          (ok true)
        )
      (err ERR-RESOURCE-NOT-FOUND)
    )
  )
)

(define-public (get-resource-count)
  (ok (var-get next-resource-id))
)

(define-public (check-resource-existence (hash (buff 32)))
  (ok (is-resource-registered hash))
)

(define-public (deactivate-resource (resource-id uint))
  (let ((resource (map-get? resources resource-id)))
    (match resource
      r
        (begin
          (asserts! (is-eq (get owner r) tx-sender) (err ERR-NOT-AUTHORIZED))
          (map-set resources resource-id
            (merge r { status: false })
          )
          (ok true)
        )
      (err ERR-RESOURCE-NOT-FOUND)
    )
  )
)

(define-public (change-owner (resource-id uint) (new-owner principal))
  (let ((resource (map-get? resources resource-id)))
    (match resource
      r
        (begin
          (asserts! (is-eq (get owner r) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-principal new-owner))
          (map-set resources resource-id
            (merge r { owner: new-owner })
          )
          (ok true)
        )
      (err ERR-RESOURCE-NOT-FOUND)
    )
  )
)