
const adviceIcons = [
  { match: /ร่ม|เสื้อกันฝน/, icon: '☂️' },
  { match: /ครีมกันแดด/, icon: '🧴' },
  { match: /น้ำดื่มและหมวก/, icon: '🧢' },
  { match: /ลมแรง/, icon: '🍃' },
  { match: /สบายและพกน้ำดื่ม/, icon: '💧' },
]

function AdviceCard({ advice }) {
  return (
    <section className="panel panel-spaced">
      <h2>ควรเตรียมอะไรบ้าง</h2>

      <ul className="advice">
        {advice.map((item, index) => (
          <li key={index}>
            <span className="advice-icon" aria-hidden="true">
              {adviceIcons.find(option => option.match.test(item))?.icon || '✨'}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default AdviceCard
