import { useTranslations } from 'next-intl'

export default function Footer() {
  const t = useTranslations('footer')
  return (
    <footer>
      {t.rich('copyright', {
        logo: (chunks) => (
          <span className="footer-logo" style={{ cursor: 'pointer' }}>
            {chunks}
          </span>
        )
      })}
    </footer>
  );
}
